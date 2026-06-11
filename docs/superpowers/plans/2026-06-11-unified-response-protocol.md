# Unified Response Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the unified WebSocket response protocol for `measured_app`, returning `{ok:true,value}` for every routed API result and `protocol_error` only when a request cannot reach a wrapper/API.

**Architecture:** Add focused dispatch response helpers, wrap the callback once in `Dispatch`, and keep Biz wrappers unaware of protocol envelopes. Generated and internal dispatch routes must catch matched-wrapper synchronous throws and async Promise rejections, then forward those values through the wrapped API callback. `RNWS.send` stops synthesizing `no return data` and defensively serializes direct `undefined` as `{ok:true,value:null}`.

**Tech Stack:** React Native TypeScript, Jest, Node.js dispatch generator, Yarn Berry.

---

## File Map

- Create: `measured_app/src/dispatch/Response.ts`
  - Owns response types and helper functions: `wrapApiCallback`, `protocolError`, and `invokeApi`.
- Create: `measured_app/__tests__/Response.test.ts`
  - Unit tests helper behavior without SDK/native dependencies.
- Create: `measured_app/__tests__/Dispatch.response.test.ts`
  - Tests `Dispatch` parsing, command validation, callback wrapping, and protocol errors by mocking `src/dispatch/index`.
- Create: `measured_app/__tests__/RNWS.response.test.ts`
  - Tests `RNWS.send(undefined)` no longer sends `no return data`.
- Modify: `measured_app/src/Dispatch.ts`
  - Validates JSON/cmd, creates wrapped API callback, returns protocol errors, and separates pre-route errors from routed API results.
- Modify: `measured_app/src/dispatch/Internal.ts`
  - Uses `invokeApi` for every internal route.
- Modify: `measured_app/scripts/generate-dispatch-routes.js`
  - Renders generated routes using `invokeApi`.
- Regenerate: `measured_app/src/dispatch/*.generated.ts`
  - Generated output only, produced by `yarn generate:dispatch`.
- Modify: `measured_app/src/RNWS.ts`
  - Defensive undefined fallback becomes `{ok:true,value:null}`.

## Task 1: Add Response Helpers

**Files:**
- Create: `measured_app/src/dispatch/Response.ts`
- Create: `measured_app/__tests__/Response.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `measured_app/__tests__/Response.test.ts`:

```typescript
import {
  invokeApi,
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

  test('protocolError builds protocol error responses', () => {
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

  test('invokeApi forwards synchronous throws to callback and returns true', () => {
    const callback = jest.fn();
    const error = new Error('boom');

    const handled = invokeApi(() => {
      throw error;
    }, callback);

    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledWith(error);
  });

  test('invokeApi forwards async rejections to callback and returns true', async () => {
    const callback = jest.fn();
    const error = new Error('async boom');

    const handled = invokeApi(() => Promise.reject(error), callback);
    await Promise.resolve();

    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledWith(error);
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
  | 'unknown_command'
  | 'dispatch_error';

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

export function invokeApi(
  invoke: () => void | Promise<unknown>,
  callback: ReturnCallback,
): true {
  try {
    const result = invoke();
    if (
      result !== null &&
      result !== undefined &&
      typeof (result as Promise<unknown>).then === 'function'
    ) {
      void (result as Promise<unknown>).catch(callback);
    }
  } catch (error) {
    callback(error);
  }
  return true;
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

  test('returns dispatch_error when pre-route dispatch throws', () => {
    mockedRoutes.dispatchChatClient.mockImplementation(() => {
      throw new Error('route table failed before wrapper entry');
    });
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'ChatClient.isConnected'}),
      callback,
    );

    expect(handled).toBe(false);
    expect(callback).toHaveBeenCalledWith({
      type: 'protocol_error',
      error: {
        type: 'dispatch_error',
        message: 'route table failed before wrapper entry',
        details: {cmd: 'ChatClient.isConnected'},
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

    try {
      for (const dispatchRoute of SDK_ROUTES) {
        if (dispatchRoute(cmd, info, apiCallback, false)) {
          return true;
        }
      }

      if (dispatchInternal(cmd, info, apiCallback)) {
        return true;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      callback(protocolError('dispatch_error', message, {cmd}));
      return false;
    }

    Logger.raw.warn(`${Dispatch.TAG}: unknown cmd: ${cmd}`);
    callback(
      protocolError('unknown_command', `unknown command: ${cmd}`, {cmd}),
    );
    return false;
  }
```

Keep `onMessage` as a thin callback-driven delegate so JSON parsing and
protocol classification have only one implementation:

```typescript
  onMessage(data: any, callback: ReturnCallback): void {
    this.dispatch(data, callback);
  }
```

- [ ] **Step 4: Run Dispatch response tests and verify they pass**

Run:

```bash
cd measured_app
yarn test __tests__/Dispatch.response.test.ts
```

Expected: PASS.

## Task 3: Catch Matched Wrapper Throws in Generated Routes

**Files:**
- Modify: `measured_app/scripts/generate-dispatch-routes.js`
- Regenerate: `measured_app/src/dispatch/*.generated.ts`
- Test: `measured_app/__tests__/Response.test.ts`

- [ ] **Step 1: Extend helper tests to prove matched route invocation behavior**

Add this test to `measured_app/__tests__/Response.test.ts`:

```typescript
  test('invokeApi does not call callback when async wrapper resolves after handling its own callback', async () => {
    const callback = jest.fn();

    const handled = invokeApi(() => Promise.resolve(), callback);
    await Promise.resolve();

    expect(handled).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run helper tests**

Run:

```bash
cd measured_app
yarn test __tests__/Response.test.ts
```

Expected: PASS after Task 1 implementation. This locks the rule that `invokeApi` catches rejections but does not synthesize success on async resolve.

- [ ] **Step 3: Update generated route template**

In `measured_app/scripts/generate-dispatch-routes.js`, change the rendered imports in `renderGeneratedRoute` to include `invokeApi`:

```javascript
import {ReturnCallback} from '../RNWS';
import {Logger} from '../Logger';
import {invokeApi} from './Response';
import {${manager.bizClass}} from '../biz/${manager.bizClass}';
```

Change generated cases from:

```javascript
    case '${manager.sdkClass}.${name}':
      ${manager.bizClass}.${name}(info, callback);
      return true;
```

to:

```javascript
    case '${manager.sdkClass}.${name}':
      return invokeApi(
        () => ${manager.bizClass}.${name}(info, callback),
        callback,
      );
```

- [ ] **Step 4: Regenerate dispatch files**

Run:

```bash
cd measured_app
yarn generate:dispatch
```

Expected: generation completes and every generated file imports `invokeApi` from `./Response`.

- [ ] **Step 5: Inspect generated route diffs**

Run:

```bash
git diff -- measured_app/scripts/generate-dispatch-routes.js measured_app/src/dispatch
```

Expected:

- `measured_app/scripts/generate-dispatch-routes.js` renders `invokeApi`.
- Every `measured_app/src/dispatch/*.generated.ts` imports `invokeApi`.
- Every generated case returns `invokeApi(() => BizClass.method(info, callback), callback)`.
- Unknown-command logging stays unchanged.

## Task 4: Catch Matched Wrapper Throws in Internal Routes

**Files:**
- Modify: `measured_app/src/dispatch/Internal.ts`
- Test: `measured_app/__tests__/Dispatch.response.test.ts`

- [ ] **Step 1: Add Internal route wrapping test**

Add this test to `measured_app/__tests__/Dispatch.response.test.ts`:

```typescript
  test('wraps internal route callback values', () => {
    mockedRoutes.dispatchInternal.mockImplementation(
      (_cmd, _info, callback) => {
        callback(null);
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
```

- [ ] **Step 2: Run Dispatch response tests**

Run:

```bash
cd measured_app
yarn test __tests__/Dispatch.response.test.ts
```

Expected: PASS after Task 2 because mocked internal routes receive the wrapped callback.

- [ ] **Step 3: Update Internal routes to use invokeApi**

Modify `measured_app/src/dispatch/Internal.ts` imports:

```typescript
import {ReturnCallback} from '../RNWS';
import {invokeApi} from './Response';
```

Change every case from:

```typescript
    case 'init':
      BizChatClient.init(info, callback);
      return true;
```

to:

```typescript
    case 'init':
      return invokeApi(() => BizChatClient.init(info, callback), callback);
```

Apply the same pattern to every internal route:

```typescript
return invokeApi(() => BizChatClient.login(info, callback), callback);
return invokeApi(() => BizChatClient.addConnectionDelegate(info, callback), callback);
return invokeApi(() => BizChatClient.deleteConnectionDelegate(info, callback), callback);
return invokeApi(() => BizChatClient.addMultiDeviceDelegate(info, callback), callback);
return invokeApi(() => BizChatClient.deleteMultiDeviceDelegate(info, callback), callback);
return invokeApi(() => BizChatContactManager.addContactManagerDelegate(info, callback), callback);
return invokeApi(() => BizChatContactManager.removeContactManagerDelegate(info, callback), callback);
return invokeApi(() => BizChatManager.addChatManagerDelegate(info, callback), callback);
return invokeApi(() => BizChatManager.removeChatManagerDelegate(info, callback), callback);
return invokeApi(() => BizChatRoomManager.addRoomManagerDelegate(info, callback), callback);
return invokeApi(() => BizChatRoomManager.removeRoomManagerDelegate(info, callback), callback);
return invokeApi(() => BizChatGroupManager.addGroupManagerDelegate(info, callback), callback);
return invokeApi(() => BizChatGroupManager.removeGroupManagerDelegate(info, callback), callback);
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd measured_app
yarn test __tests__/Dispatch.response.test.ts __tests__/Response.test.ts
```

Expected: PASS.

## Task 5: Remove RNWS no-return String

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

This keeps `null` as a direct payload if a caller explicitly sends `null`; normal Dispatch responses should already be shaped before reaching RNWS.

- [ ] **Step 4: Run RNWS test and verify it passes**

Run:

```bash
cd measured_app
yarn test __tests__/RNWS.response.test.ts
```

Expected: PASS.

## Task 6: End-to-End Validation

**Files:**
- Read: `measured_app/src/Dispatch.ts`
- Read: `measured_app/src/dispatch/Response.ts`
- Read: `measured_app/src/dispatch/Internal.ts`
- Read: `measured_app/src/dispatch/*.generated.ts`
- Read: `measured_app/src/RNWS.ts`

- [ ] **Step 1: Run all focused response tests**

Run:

```bash
cd measured_app
yarn test __tests__/Response.test.ts __tests__/Dispatch.response.test.ts __tests__/RNWS.response.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run dispatch generation and audit**

Run:

```bash
cd measured_app
yarn generate:dispatch
yarn audit:chat-sdk-api
```

Expected:

- Dispatch generation completes.
- Audit exits 0.
- `missing active wrappers` is `none`.
- `deprecated wrappers present` is `none`.
- `active wrappers not routed: 0`.
- `routes without active sdk method: 0`.

- [ ] **Step 3: Run lint**

Run:

```bash
cd measured_app
yarn lint
```

Expected: PASS with exit code 0.

- [ ] **Step 4: Run full Jest suite**

Run:

```bash
cd measured_app
yarn test
```

Expected: PASS. If Jest fails only because the sandbox cannot access Watchman, rerun the same command with the required sandbox escalation and report that the first failure was environmental.

- [ ] **Step 5: Inspect final response protocol diff**

Run:

```bash
git diff -- measured_app/src/Dispatch.ts measured_app/src/dispatch measured_app/scripts/generate-dispatch-routes.js measured_app/src/RNWS.ts measured_app/__tests__
```

Expected:

- API callbacks are wrapped exactly once in `Dispatch`.
- Protocol errors are created only in Dispatch-level code.
- Generated/internal routes use `invokeApi`.
- Biz wrapper files are unchanged.
- No response path sends `no return data`.
- No implementation introduces `ok: false`.

- [ ] **Step 6: Commit once after validation**

After all validation passes, make one implementation commit:

```bash
git add measured_app/src/Dispatch.ts measured_app/src/dispatch/Response.ts measured_app/src/dispatch/Internal.ts measured_app/src/dispatch/*.generated.ts measured_app/scripts/generate-dispatch-routes.js measured_app/src/RNWS.ts measured_app/__tests__/Response.test.ts measured_app/__tests__/Dispatch.response.test.ts measured_app/__tests__/RNWS.response.test.ts
git commit -m "feat: unify websocket response protocol"
```

## Self-Review

- Spec coverage: This plan implements two response shapes, `{ok:true,value}` API responses, `protocol_error` responses, `undefined` to `null`, no `ok:false`, Dispatch-level helpers, matched-wrapper throw handling, RNWS no-return removal, and focused tests.
- Placeholder scan: No placeholders remain; every code-changing step includes concrete code or exact replacement patterns.
- Type consistency: Helper names are `wrapApiCallback`, `protocolError`, and `invokeApi`; protocol error types match the spec exactly.
