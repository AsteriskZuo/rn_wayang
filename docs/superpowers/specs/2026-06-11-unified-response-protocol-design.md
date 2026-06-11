# Unified Response Protocol Design

## Context

`measured_app` is a puppet app for exercising `react-native-chat-sdk` through
WebSocket commands. It is a routing and transport layer for SDK tests, not a
business service. The response protocol should make it clear whether a request
reached the target SDK wrapper, while preserving the SDK result itself without
interpretation.

Current responses are inconsistent:

- `BizBase.tryCatch` forwards SDK resolve values and reject errors directly.
- Many wrappers call `callback(null)` or `callback(undefined)` for void-style
  operations.
- `RNWS.send(undefined)` sends the string `no return data`.
- Dispatch parse and unknown-command failures log warnings but do not return a
  structured protocol error to the driver.

The new protocol intentionally does not preserve historical response shapes.

## Decisions

- Treat the puppet app as a transparent SDK test mediator. It must not
  transform SDK input parameters or SDK/API output values except for the
  response transport envelope and the `undefined` to `null` JSON normalization.
- Use exactly two top-level response shapes: API response and protocol error.
- API responses always use `{ok: true, value: ...}`.
- API results are not interpreted by the puppet. SDK errors, wrapper callback
  values, callback `onError` values, and successful SDK values all go into
  `value`.
- Do not introduce `ok: false`.
- Normalize `undefined` API values to `null`, because JSON cannot reliably
  represent `undefined`.
- Use a separate protocol error response only when the request does not reach a
  target wrapper/API.
- Keep protocol error construction in Dispatch-level helpers; do not pass a
  protocol callback into Biz wrappers.
- Do not add a route-level exception wrapper for every SDK route in this
  change. Known explicit throws are fixed at their source so the implementation
  stays aligned with the puppet principle: do not transform input parameters or
  SDK/API outputs.

## Response Shapes

API response:

```typescript
type ApiResponse = {
  ok: true;
  value: any;
};
```

JSON examples:

```json
{"ok": true, "value": {"userId": "u1"}}
```

```json
{"ok": true, "value": null}
```

If the SDK or wrapper returns an error object, it is still the API result:

```json
{"ok": true, "value": {"code": 1, "message": "sdk error"}}
```

Protocol error response:

```typescript
type ProtocolErrorResponse = {
  type: 'protocol_error';
  error: {
    type:
      | 'invalid_json'
      | 'invalid_command'
      | 'unknown_command';
    message: string;
    details?: any;
  };
};
```

JSON example:

```json
{
  "type": "protocol_error",
  "error": {
    "type": "unknown_command",
    "message": "unknown command: ChatManager.foo",
    "details": {}
  }
}
```

## Classification Rule

The boundary is whether the request reaches the target wrapper/API.

If a command is matched and control enters the target wrapper, every callback
value after that point is an API response:

- SDK Promise resolve.
- SDK Promise reject.
- SDK callback `onError`.
- Wrapper callback with an error object.
- Missing or invalid API-specific parameters that reach the SDK/API and produce
  an SDK/API result.

Biz wrappers should not create puppet-specific error semantics by throwing
custom errors for unsupported SDK inputs. If a wrapper cannot construct an SDK
input for a route-specific helper, it should call the API callback with a
route-local result and stop before calling the SDK API. For `sendMessage`, this
means `createMessage(info, callback)` returns `ChatMessage | undefined`; when
the message type is unsupported it calls `callback(undefined)` and returns
`undefined`, and `sendMessage` returns without calling `chatManager.sendMessage`.

If the request does not reach a target wrapper/API, return a protocol error:

- Payload cannot be parsed as JSON.
- Parsed JSON does not contain a non-empty string `cmd`.
- `cmd` is valid but no generated or internal route matches it.

`info` may be absent or `undefined`. Some SDK APIs take no arguments, so missing
`info` is not a protocol error. If a specific wrapper/API requires fields and
fails because they are absent, that failure is an API response.

## Helpers

Add small Dispatch-level response helpers:

```typescript
function normalizeApiValue(value: any): any {
  return value === undefined ? null : value;
}

function wrapApiCallback(callback: ReturnCallback): ReturnCallback {
  return value => callback({ok: true, value: normalizeApiValue(value)});
}

function protocolError(
  type: ProtocolErrorResponse['error']['type'],
  message: string,
  details?: any,
): ProtocolErrorResponse {
  return {type: 'protocol_error', error: {type, message, details}};
}
```

`wrapApiCallback` is the only callback passed into generated/internal routes.
`protocolError` is used only by Dispatch when the request cannot be delivered to
a wrapper/API.

## Dispatch Flow

1. `RNWS.onmessage` receives a WebSocket payload and passes it to
   `Dispatch.onMessage`.
2. `Dispatch` parses the payload.
3. If JSON parsing fails, callback `protocolError('invalid_json', ...)`.
4. If `cmd` is missing, not a string, or an empty string, callback
   `protocolError('invalid_command', ...)`.
5. Create an API callback with `wrapApiCallback(callback)`.
6. Try generated SDK routes, then internal routes with that API callback.
7. If a route handles the command, the wrapper's callback output is returned as
   `{ok: true, value: ...}`.
8. If no route handles the command, callback
   `protocolError('unknown_command', ...)`.
Generated and internal route contracts can stay boolean-based. They should not
wrap every matched route in a broad try/catch for this change; instead, remove
known explicit throws and keep wrapper behavior thin.

## RNWS Sending

`RNWS.send` should no longer synthesize the string `no return data`.

The preferred invariant is that `Dispatch` always calls back with either an API
response or a protocol error response. `RNWS.send` should stringify non-string
objects and may normalize a direct `undefined` defensively to:

```json
{"ok": true, "value": null}
```

This fallback is defensive only; normal response shaping belongs in Dispatch.

## Non-Goals

- No backward-compatible response mode.
- No legacy bare SDK value response.
- No `ok: false` API response.
- No SDK result or SDK error field rewriting.
- No full parameter schema validation in this change.
- No attempt to define SDK/API error codes. SDK error objects remain in
  `value`.

## Implementation Review Gate

During implementation, stop and ask the user before proceeding if a discovered
case would require any of these changes:

- Transforming SDK input parameters to make a request fit the protocol.
- Transforming SDK/API output values or SDK error objects.
- Inventing a puppet-specific SDK error object or error code.
- Adding another response shape or changing the two response shapes in this
  spec.
- Adding a broad exception wrapper around generated/internal routes.
- Choosing behavior for a wrapper edge case that this spec does not explicitly
  define.

The implementation should update this spec first if the user approves a design
change.

## Testing

Add focused Jest coverage for the protocol boundary:

- API resolve value returns `{ok: true, value}`.
- API callback `undefined` returns `{ok: true, value: null}`.
- API callback error object returns `{ok: true, value: errorObject}`.
- `sendMessage` with an unsupported message type calls the API callback and
  returns `{ok: true, value: ...}` without throwing a puppet-created exception.
- Invalid JSON returns `type: 'protocol_error'` and
  `error.type: 'invalid_json'`.
- Missing, non-string, or empty `cmd` returns `error.type:
  'invalid_command'`.
- Unknown command returns `error.type: 'unknown_command'`.
- `RNWS.send(undefined)` no longer sends `no return data`.

## Open Points

None.
