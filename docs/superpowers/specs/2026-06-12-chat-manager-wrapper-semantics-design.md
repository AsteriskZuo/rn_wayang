# ChatManager Wrapper Semantics Design

## Context

`measured_app` exposes `react-native-chat-sdk` through WebSocket commands. It is
the measured puppet app, not a test-data adapter. Wrappers should call the SDK
with the data supplied by the driver and return the actual SDK or wrapper result
through the unified response protocol.

The previous JMeter positive coverage pass found several `BizChatManager`
wrappers whose current behavior hides or changes the SDK API semantics:

- `ChatManager.sendMessage`
- `ChatManager.insertMessage`
- `ChatManager.updateMessage`
- `ChatManager.modifyMsgBody`

## Goal

Fix the `BizChatManager` message wrapper semantics so each route passes data to
the SDK according to the SDK method contract, without making the measured app
repair driver input or fabricate successful outcomes.

## Non-Goals

- Do not modify `ChatGroupManager` shared-file upload or download in this
  design.
- Do not add fixture files, runtime file-path helpers, or `react-native-fs`.
- Do not run broad `audit:chat-sdk-api` quality convergence work.
- Do not change generated dispatch route names.
- Do not change the unified response protocol.
- Do not require every JMeter positive sampler to pass if the SDK rejects the
  supplied object shape.

## Principle

`measured_app` is a transparent SDK test mediator. It should not transform SDK
inputs beyond the route-specific wrapper behavior already required to reach the
SDK API.

The wrapper must not:

- Rebuild a complete object that the caller was expected to provide.
- Patch missing fields to make a test pass.
- Convert plain JSON into SDK class instances unless that conversion is the
  established wrapper input model for that route.
- Modify SDK return values.
- Report success when the SDK call did not actually run or complete.

SDK acceptance or rejection of plain JSON objects is a valid test result.

## Route Semantics

### `ChatManager.sendMessage`

`sendMessage` keeps the existing measured-app wrapper model: the driver supplies
a small message description, and the wrapper uses `ChatMessage.create*Message`
factory methods to construct the message that is sent.

The current gap is that `createMessage` always creates `PeerChat` messages. It
must use the existing `createChatType(info)` helper so the driver can request:

- default `PeerChat`;
- `GroupChat`;
- `ChatRoom` / `RoomChat`.

Accepted chat-type input fields are the existing wrapper aliases:

- `chatType`;
- `conversationType`;
- `convType`.

The default remains `PeerChat` to preserve existing payload behavior.

The existing message type coverage remains the baseline:

- `text`;
- `image`;
- `video`;
- `voice`;
- `location`;
- `cmd`;
- `custom`.

This design does not require adding new message factory types.

### `ChatManager.insertMessage`

`insertMessage` should not call `createMessage`.

The SDK method contract is `insertMessage(message: ChatMessage): Promise<void>`.
The caller is expected to provide a complete message object representing the
message to insert into the local database.

The wrapper should read `info.message` and pass it unchanged to:

```typescript
ChatClient.getInstance().chatManager.insertMessage(message)
```

The wrapper should not construct a text message, fill defaults, or alter the
message payload.

### `ChatManager.updateMessage`

`updateMessage` should not create a new peer text message.

The SDK method contract is `updateMessage(message: ChatMessage):
Promise<ChatMessage>`. The caller is expected to provide the complete local
message object to update.

The wrapper should read `info.message` and pass it unchanged to:

```typescript
ChatClient.getInstance().chatManager.updateMessage(message)
```

This avoids losing caller-provided fields such as `msgId`, local timestamps,
message direction, body, extensions, and chat type.

### `ChatManager.modifyMsgBody`

`modifyMsgBody` should keep passing the supplied body through to the SDK.

`Dispatch.ts` parses the WebSocket payload with `JSON.parse`, so a JMeter JSON
object becomes a plain JavaScript object. That object is not automatically a
`ChatTextMessageBody`, `ChatCustomMessageBody`, or any other SDK class
instance. This design intentionally does not convert it.

The wrapper should keep calling:

```typescript
ChatClient.getInstance().chatManager.modifyMsgBody({msgId, body, ext})
```

where `body` is `info.body` and `ext` is `info.ext`.

If the SDK bridge accepts the plain object, the route succeeds. If the SDK
bridge rejects it, the SDK error is the correct API result.

## Input Contract

`sendMessage` continues to use the current field model, including:

- `type`;
- `username`;
- message-type-specific fields such as `content`, `localPath`, `displayName`,
  `duration`, `latitude`, `longitude`, `action`, `event`, and `data`;
- `chatType`, `conversationType`, or `convType` for chat type selection.

`insertMessage` and `updateMessage` use:

```json
{
  "message": {}
}
```

Only `info.message` is part of this design. The wrapper should not guess from
`info.msg` or treat the entire `info` object as the message. Keeping a single
field makes the route contract explicit and avoids accidental reinterpretation
of envelope fields as SDK message fields.

`modifyMsgBody` uses:

```json
{
  "messageId": "message-id",
  "body": {},
  "ext": {}
}
```

`msgId` remains accepted where the existing wrapper already accepts it.

## Error Handling

Wrappers continue to use `BizBase.tryCatch` for SDK Promise resolve/reject
normalization.

If `insertMessage` or `updateMessage` is called without `info.message`, the
wrapper should not manufacture a message. It should read `info?.message` and
pass that value unchanged to the SDK, including `undefined` when the field is
absent. The SDK or bridge result is then returned through the API callback. The
wrapper must not report a successful insert/update without an SDK call.

`modifyMsgBody` must not catch bridge errors and convert them into success.

## Validation

Run from `measured_app`:

```bash
yarn lint
yarn test
```

If generated dispatch files are unexpectedly changed during implementation, run:

```bash
yarn generate:dispatch
```

and review the diff before continuing.

Runtime behavior should be evaluated by whether the wrapper reaches the correct
SDK method with the supplied data and returns the actual SDK result. A sampler
that returns an SDK error because the supplied plain object is invalid is still
valid evidence that the measured app did not repair or falsify the input.

## Follow-Up

Group shared-file upload/download is covered by a separate design. Broad wrapper
quality convergence is out of scope for this design.

## Self-Review

- Placeholder scan: no `TBD` or open placeholder remains.
- Scope check: this design is limited to `BizChatManager` message wrapper
  semantics.
- Consistency check: `sendMessage` is the only route that keeps factory-based
  message construction; `insertMessage`, `updateMessage`, and `modifyMsgBody`
  pass caller-provided objects through.
