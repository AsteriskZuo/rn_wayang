# Unified Response Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the unified WebSocket response protocol for `measured_app`, returning `{ok:true,value}` for routed API results and `protocol_error` only when a request cannot reach a wrapper/API.

**Architecture:** Add small Dispatch-level response helpers, wrap the callback once in `Dispatch`, and keep SDK/Biz outputs uninterpreted. Remove the two known explicit throw paths: Dispatch invalid input becomes a protocol error, and `BizChatManager.createMessage` reports unsupported puppet message types through the API callback without inventing an error object. Do not modify generated SDK routes or Biz wrappers unrelated to the known throw path.

**Tech Stack:** React Native TypeScript, Jest, Yarn Berry.

---

## File Map

- Create: `measured_app/src/dispatch/Response.ts`
  - Owns response types and helper functions: `wrapApiCallback` and `protocolError`.
- Create: `measured_app/__tests__/Response.test.ts`
  - Unit tests helper behavior without SDK/native dependencies.
- Create: `measured_app/__tests__/Dispatch.response.test.ts`
  - Tests `Dispatch` parsing, command validation, callback wrapping, and protocol errors by mocking `src/dispatch/index`.
- Create: `measured_app/__tests__/RNWS.response.test.ts`
  - Tests `RNWS.send(undefined)` no longer sends `no return data`.
- Modify: `measured_app/src/Dispatch.ts`
  - Validates JSON/cmd, creates wrapped API callback, and returns protocol errors for invalid/unknown commands.
- Modify: `measured_app/src/biz/BizChatManager.ts`
  - Changes `createMessage` to accept `callback`, return `ChatMessage | undefined`, and avoid `throw new Error('not support this type.')`.
- Modify: `measured_app/src/RNWS.ts`
  - Defensive undefined fallback becomes `{ok:true,value:null}`.

## Execution Guardrails

- Follow the `Implementation Review Gate` in
  `docs/superpowers/specs/2026-06-11-unified-response-protocol-design.md`.
- Do not add `ok:false`.
- Do not transform SDK input parameters or SDK/API output objects.
- Do not add broad generated-route exception wrappers in this change.
- Do not modify generated dispatch files for this feature.
- If implementation reveals a special case that appears to require transforming SDK inputs/outputs, inventing SDK error semantics, or adding another response shape, stop and ask the user before changing the design.
- If a test fails, investigate root cause before changing the test. If the
  failure suggests the design, response semantics, or test contract may be
  wrong, stop and ask the user before modifying the test expectation or the
  spec.

## Task 1: Add Response Helpers

**Files:**
- Create: `measured_app/src/dispatch/Response.ts`
- Create: `measured_app/__tests__/Response.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `measured_app/__tests__/Response.test.ts`:

```typescript
import {
  protocolError,
  wrapApiCallback,
} from '../src/dispatch/Response';

describe('response helpers', () => {
  test('wrapApiCallback wraps ordinary values', () => {
    const callback = jest.fn();
    const apiCallback = wrapApiCallback(callback);

    apiCallback({userId: 'u1'});

    expect(callback).toHaveBeenCalledWith({
      ok: true,
      value: {userId: 'u1'},
    });
  });

  test('wrapApiCallback normalizes undefined to null', () => {
    const callback = jest.fn();
    const apiCallback = wrapApiCallback(callback);

    apiCallback(undefined);

    expect(callback).toHaveBeenCalledWith({ok: true, value: null});
  });

  test('wrapApiCallback keeps error objects as value', () => {
    const callback = jest.fn();
    const apiCallback = wrapApiCallback(callback);
    const error = {code: 1, message: 'sdk error'};

    apiCallback(error);

    expect(callback).toHaveBeenCalledWith({ok: true, value: error});
  });

  test('protocolError builds protocol error responses with details', () => {
    expect(
      protocolError('unknown_command', 'unknown command: ChatManager.foo', {
        cmd: 'ChatManager.foo',
      }),
    ).toEqual({
      type: 'protocol_error',
      error: {
        type: 'unknown_command',
        message: 'unknown command: ChatManager.foo',
        details: {cmd: 'ChatManager.foo'},
      },
    });
  });

  test('protocolError omits details when none are provided', () => {
    expect(protocolError('invalid_json', 'request body is not valid JSON')).toEqual({
      type: 'protocol_error',
      error: {
        type: 'invalid_json',
        message: 'request body is not valid JSON',
      },
    });
  });
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
cd measured_app
yarn test __tests__/Response.test.ts
```

Expected: FAIL because `../src/dispatch/Response` does not exist.

- [ ] **Step 3: Implement response helpers**

Create `measured_app/src/dispatch/Response.ts`:

```typescript
import {ReturnCallback} from '../RNWS';

export type ApiResponse = {
  ok: true;
  value: any;
};

export type ProtocolErrorType =
  | 'invalid_json'
  | 'invalid_command'
  | 'unknown_command';

export type ProtocolErrorResponse = {
  type: 'protocol_error';
  error: {
    type: ProtocolErrorType;
    message: string;
    details?: any;
  };
};

export function normalizeApiValue(value: any): any {
  return value === undefined ? null : value;
}

export function wrapApiCallback(callback: ReturnCallback): ReturnCallback {
  return value => callback({ok: true, value: normalizeApiValue(value)});
}

export function protocolError(
  type: ProtocolErrorType,
  message: string,
  details?: any,
): ProtocolErrorResponse {
  return {
    type: 'protocol_error',
    error: details === undefined ? {type, message} : {type, message, details},
  };
}
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```bash
cd measured_app
yarn test __tests__/Response.test.ts
```

Expected: PASS.

## Task 2: Wrap API Results and Return Protocol Errors in Dispatch

**Files:**
- Modify: `measured_app/src/Dispatch.ts`
- Create: `measured_app/__tests__/Dispatch.response.test.ts`

- [ ] **Step 1: Write failing Dispatch response tests**

Create `measured_app/__tests__/Dispatch.response.test.ts`:

```typescript
jest.mock('../src/dispatch/index', () => ({
  dispatchChatClient: jest.fn(() => false),
  dispatchChatManager: jest.fn(() => false),
  dispatchChatGroupManager: jest.fn(() => false),
  dispatchChatRoomManager: jest.fn(() => false),
  dispatchChatContactManager: jest.fn(() => false),
  dispatchChatPresenceManager: jest.fn(() => false),
  dispatchChatPushManager: jest.fn(() => false),
  dispatchChatUserInfoManager: jest.fn(() => false),
  dispatchInternal: jest.fn(() => false),
}));

import {Dispatch} from '../src/Dispatch';
import * as routes from '../src/dispatch/index';

const mockedRoutes = routes as jest.Mocked<typeof routes>;

function resetRoutes() {
  mockedRoutes.dispatchChatClient.mockReturnValue(false);
  mockedRoutes.dispatchChatManager.mockReturnValue(false);
  mockedRoutes.dispatchChatGroupManager.mockReturnValue(false);
  mockedRoutes.dispatchChatRoomManager.mockReturnValue(false);
  mockedRoutes.dispatchChatContactManager.mockReturnValue(false);
  mockedRoutes.dispatchChatPresenceManager.mockReturnValue(false);
  mockedRoutes.dispatchChatPushManager.mockReturnValue(false);
  mockedRoutes.dispatchChatUserInfoManager.mockReturnValue(false);
  mockedRoutes.dispatchInternal.mockReturnValue(false);
}

describe('Dispatch unified response protocol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRoutes();
  });

  test('wraps routed API callback values', () => {
    mockedRoutes.dispatchChatClient.mockImplementation(
      (_cmd, _info, callback) => {
        callback('connected');
        return true;
      },
    );
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'ChatClient.isConnected'}),
      callback,
    );

    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledWith({ok: true, value: 'connected'});
  });

  test('wraps routed API callback undefined as null', () => {
    mockedRoutes.dispatchInternal.mockImplementation(
      (_cmd, _info, callback) => {
        callback(undefined);
        return true;
      },
    );
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'login'}),
      callback,
    );

    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledWith({ok: true, value: null});
  });

  test('wraps routed API error objects as value', () => {
    const sdkError = {code: 1, message: 'sdk error'};
    mockedRoutes.dispatchChatManager.mockImplementation(
      (_cmd, _info, callback) => {
        callback(sdkError);
        return true;
      },
    );
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'ChatManager.sendMessage'}),
      callback,
    );

    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledWith({ok: true, value: sdkError});
  });

  test('returns invalid_json protocol error', () => {
    const callback = jest.fn();

    const handled = new Dispatch().dispatch('{not json', callback);

    expect(handled).toBe(false);
    expect(callback).toHaveBeenCalledWith({
      type: 'protocol_error',
      error: {
        type: 'invalid_json',
        message: 'request body is not valid JSON',
        details: {data: '{not json'},
      },
    });
  });

  test.each([
    [{}],
    [{cmd: ''}],
    [{cmd: '   '}],
    [{cmd: 123}],
  ])('returns invalid_command protocol error for %p', request => {
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(JSON.stringify(request), callback);

    expect(handled).toBe(false);
    expect(callback).toHaveBeenCalledWith({
      type: 'protocol_error',
      error: {
        type: 'invalid_command',
        message: 'request cmd must be a non-empty string',
        details: {cmd: (request as any).cmd},
      },
    });
  });

  test('returns unknown_command protocol error', () => {
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'ChatManager.nope'}),
      callback,
    );

    expect(handled).toBe(false);
    expect(callback).toHaveBeenCalledWith({
      type: 'protocol_error',
      error: {
        type: 'unknown_command',
        message: 'unknown command: ChatManager.nope',
        details: {cmd: 'ChatManager.nope'},
      },
    });
  });
});
```

- [ ] **Step 2: Run Dispatch response tests and verify they fail**

Run:

```bash
cd measured_app
yarn test __tests__/Dispatch.response.test.ts
```

Expected: FAIL because current `Dispatch` forwards raw callbacks and does not return protocol error responses.

- [ ] **Step 3: Update Dispatch**

Modify `measured_app/src/Dispatch.ts` to import helpers:

```typescript
import {
  protocolError,
  wrapApiCallback,
} from './dispatch/Response';
```

Replace `onMessage` with a thin delegate:

```typescript
  onMessage(data: any, callback: ReturnCallback): void {
    this.dispatch(data, callback);
  }
```

Replace `dispatch(data: any, callback: ReturnCallback): boolean` with:

```typescript
  dispatch(data: any, callback: ReturnCallback): boolean {
    let dataObject;
    try {
      dataObject = JSON.parse(data);
    } catch (error) {
      Logger.json.warn(`${Dispatch.TAG}: dispatch parse failed:`, data, error);
      callback(
        protocolError('invalid_json', 'request body is not valid JSON', {
          data,
        }),
      );
      return false;
    }

    const cmd = dataObject?.cmd;
    if (typeof cmd !== 'string' || cmd.trim().length === 0) {
      callback(
        protocolError('invalid_command', 'request cmd must be a non-empty string', {
          cmd,
        }),
      );
      return false;
    }

    const info = dataObject.info;
    Logger.json.log(`${Dispatch.TAG}: dispatch:`, cmd, info);

    const apiCallback = wrapApiCallback(callback);

    for (const dispatchRoute of SDK_ROUTES) {
      if (dispatchRoute(cmd, info, apiCallback, false)) {
        return true;
      }
    }

    if (dispatchInternal(cmd, info, apiCallback)) {
      return true;
    }

    Logger.raw.warn(`${Dispatch.TAG}: unknown cmd: ${cmd}`);
    callback(
      protocolError('unknown_command', `unknown command: ${cmd}`, {cmd}),
    );
    return false;
  }
```

- [ ] **Step 4: Run Dispatch response tests and verify they pass**

Run:

```bash
cd measured_app
yarn test __tests__/Dispatch.response.test.ts
```

Expected: PASS.

## Task 3: Remove BizChatManager's Puppet-Created Message-Type Throw

**Files:**
- Modify: `measured_app/src/biz/BizChatManager.ts`
- Create: `measured_app/__tests__/BizChatManager.response.test.ts`

- [ ] **Step 1: Write failing sendMessage unsupported-type test**

Create `measured_app/__tests__/BizChatManager.response.test.ts`:

```typescript
import {BizChatManager} from '../src/biz/BizChatManager';

describe('BizChatManager response protocol behavior', () => {
  test('createMessage unsupported puppet message type callbacks undefined and returns undefined', () => {
    const callback = jest.fn();

    const message = BizChatManager.createMessage({type: 'unsupported'}, callback);

    expect(message).toBeUndefined();
    expect(callback).toHaveBeenCalledWith(undefined);
  });
});
```

- [ ] **Step 2: Run BizChatManager response test and verify it fails**

Run:

```bash
cd measured_app
yarn test __tests__/BizChatManager.response.test.ts
```

Expected: FAIL because `createMessage` currently throws `not support this type.`

- [ ] **Step 3: Update createMessage signature and unsupported type path**

In `measured_app/src/biz/BizChatManager.ts`, change:

```typescript
  static createMessage(info: any): ChatMessage {
```

to:

```typescript
  static createMessage(
    info: any,
    callback?: ReturnCallback,
  ): ChatMessage | undefined {
```

Replace:

```typescript
    } else {
      throw new Error('not support this type.');
    }
    return message;
```

with:

```typescript
    } else {
      callback?.(undefined);
      return undefined;
    }
    return message;
```

In `sendMessage`, change:

```typescript
    const msg = this.createMessage(info);
    this.tryCatch(
```

to:

```typescript
    const msg = this.createMessage(info, callback);
    if (msg === undefined) {
      return;
    }
    this.tryCatch(
```

- [ ] **Step 4: Update other createMessage call sites**

Review `BizChatManager.ts` for `this.createMessage(`. For every call that requires a `ChatMessage`, add a guard if the returned value can be `undefined`.

Required edits based on current call sites:

```typescript
const msg = this.createMessage(info, callback);
if (msg === undefined) {
  return;
}
```

Use this pattern in methods that currently call `this.createMessage(info)` before an SDK call, including:

- `sendMessage`
- `insertMessage`
- `updateConversationMessage` fallback path

`importMessages` maps a list of raw inputs to SDK `ChatMessage[]`. Do not skip unsupported elements or insert placeholders without user confirmation, because either choice would change SDK input semantics. If `importMessages` needs special handling after `createMessage` becomes optional, stop and ask the user before editing that call site.

- [ ] **Step 5: Run BizChatManager response test and verify it passes**

Run:

```bash
cd measured_app
yarn test __tests__/BizChatManager.response.test.ts
```

Expected: PASS.

## Task 4: Remove RNWS no-return String

**Files:**
- Modify: `measured_app/src/RNWS.ts`
- Create: `measured_app/__tests__/RNWS.response.test.ts`

- [ ] **Step 1: Write failing RNWS send test**

Create `measured_app/__tests__/RNWS.response.test.ts`:

```typescript
import {RNWS} from '../src/RNWS';

describe('RNWS response sending', () => {
  test('send(undefined) serializes an API null response instead of no return data', () => {
    const rnws = new RNWS();
    const send = jest.fn();
    (rnws as any).ws = {send};

    rnws.send(undefined);

    expect(send).toHaveBeenCalledWith(JSON.stringify({ok: true, value: null}));
    expect(send).not.toHaveBeenCalledWith('no return data');
  });
});
```

- [ ] **Step 2: Run RNWS test and verify it fails**

Run:

```bash
cd measured_app
yarn test __tests__/RNWS.response.test.ts
```

Expected: FAIL because current `RNWS.send(undefined)` sends `no return data`.

- [ ] **Step 3: Update RNWS.send fallback**

In `measured_app/src/RNWS.ts`, replace:

```typescript
    if (!(data === null || data === undefined)) {
      this.ws?.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      this.ws?.send('no return data');
    }
```

with:

```typescript
    const payload = data === undefined ? {ok: true, value: null} : data;
    this.ws?.send(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    );
```

Normal Dispatch responses should already be shaped before reaching RNWS. This fallback is defensive for direct callers.

- [ ] **Step 4: Run RNWS test and verify it passes**

Run:

```bash
cd measured_app
yarn test __tests__/RNWS.response.test.ts
```

Expected: PASS.

## Task 5: End-to-End Validation

**Files:**
- Read: `measured_app/src/Dispatch.ts`
- Read: `measured_app/src/dispatch/Response.ts`
- Read: `measured_app/src/biz/BizChatManager.ts`
- Read: `measured_app/src/RNWS.ts`

- [ ] **Step 1: Run all focused response tests**

Run:

```bash
cd measured_app
yarn test __tests__/Response.test.ts __tests__/Dispatch.response.test.ts __tests__/BizChatManager.response.test.ts __tests__/RNWS.response.test.ts
```

Expected: PASS.

- [ ] **Step 2: Confirm no explicit throw remains under measured_app/src**

Run:

```bash
rg "throw\\s+new|throw\\s+" measured_app/src -n
```

Expected: no output. If output remains, inspect it. If it is a new special case that conflicts with the no-input/no-output-transformation principle, stop and ask the user before changing the design.

- [ ] **Step 3: Run dispatch generation and audit**

Run:

```bash
cd measured_app
yarn generate:dispatch
yarn audit:chat-sdk-api
```

Expected:

- Dispatch generation completes with no source changes beyond normal formatting.
- Audit exits 0.
- `missing active wrappers` is `none`.
- `deprecated wrappers present` is `none`.
- `active wrappers not routed: 0`.
- `routes without active sdk method: 0`.

- [ ] **Step 4: Run lint**

Run:

```bash
cd measured_app
yarn lint
```

Expected: PASS with exit code 0.

- [ ] **Step 5: Run full Jest suite**

Run:

```bash
cd measured_app
yarn test
```

Expected: PASS. If Jest fails only because the sandbox cannot access Watchman, rerun the same command with the required sandbox escalation and report that the first failure was environmental.

- [ ] **Step 6: Inspect final response protocol diff**

Run:

```bash
git diff -- measured_app/src/Dispatch.ts measured_app/src/dispatch/Response.ts measured_app/src/biz/BizChatManager.ts measured_app/src/RNWS.ts measured_app/__tests__
```

Expected:

- API callbacks are wrapped exactly once in `Dispatch`.
- Protocol errors are created only in Dispatch-level code.
- Biz wrapper files other than `BizChatManager.ts` are unchanged.
- Generated dispatch files are unchanged.
- No response path sends `no return data`.
- No implementation introduces `ok: false`.
- No implementation adds broad route-level exception wrappers.

- [ ] **Step 7: Commit once after validation**

After all validation passes, make one implementation commit:

```bash
git add measured_app/src/Dispatch.ts measured_app/src/dispatch/Response.ts measured_app/src/biz/BizChatManager.ts measured_app/src/RNWS.ts measured_app/__tests__/Response.test.ts measured_app/__tests__/Dispatch.response.test.ts measured_app/__tests__/BizChatManager.response.test.ts measured_app/__tests__/RNWS.response.test.ts
git commit -m "feat: unify websocket response protocol"
```

## Self-Review

- Spec coverage: This plan implements two response shapes, `{ok:true,value}` API responses, `protocol_error` responses, `undefined` to `null`, no `ok:false`, Dispatch-level helpers, removal of known explicit throws, RNWS no-return removal, and focused tests.
- Placeholder scan: No placeholders remain; every code-changing step includes concrete code or exact replacement patterns.
- Type consistency: Helper names are `wrapApiCallback` and `protocolError`; protocol error types match the spec exactly.
