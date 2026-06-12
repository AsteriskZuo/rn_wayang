# JMeter Positive API Coverage Record

## Context

This record captures issues discovered while adding positive JMeter coverage for
the generated Chat SDK routes.

The current implementation task does not modify `measured_app`. When a route can
be represented by a positive JMeter sampler but the measured app wrapper limits
what the sampler proves, the sampler is still added and the limitation is
recorded here for a later measured app task.

## Follow-Up Items

### ChatGroupManager Shared File APIs

Affected routes:

- `ChatGroupManager.uploadGroupSharedFile`
- `ChatGroupManager.downloadGroupSharedFile`

Current wrapper behavior:

- The SDK calls are commented out.
- The wrapper immediately calls `callback(null)` and returns.

Reason:

- The SDK calls were disabled because JMeter hit per-sampler timeout issues.
- Restoring the SDK calls currently also requires measured app code fixes.

Current JMeter coverage decision:

- Keep positive samplers for both routes.
- Treat `"ok":true` as proof that the command reached the wrapper and returned
  through the protocol.
- Do not claim that the SDK upload/download call was executed in this task.
- Use or reserve a longer file-transfer timeout variable in JMeter, such as
  `fileTransferTimeout`.

Later measured app work:

- Restore and fix the SDK upload/download wrapper calls.
- Set an appropriate JMeter timeout for shared file upload/download samplers.
- Prefer a fixed file bundled with the app resources so the upload path is stable
  and does not depend on manual file selection.

### ChatManager.modifyMsgBody

Affected route:

- `ChatManager.modifyMsgBody`

Current wrapper behavior:

- The wrapper passes `info.body as ChatMessageBody` to the SDK.

Current JMeter coverage decision:

- Pass `body` as a JSON object from JMeter, not as a quoted JSON string.
- Treat the positive sampler as valid unless runtime testing proves the SDK
  bridge cannot convert the object through its normal JSON conversion path.

Later measured app work:

- If runtime testing shows the bridge cannot convert the plain JSON body, add a
  measured app helper that constructs the body by message type before calling the
  SDK.

### ChatManager.sendMessage And insertMessage Chat Type

Affected routes:

- `ChatManager.sendMessage`
- `ChatManager.insertMessage`

Current wrapper behavior:

- `createMessage` always creates `PeerChat` messages.
- JMeter cannot currently request `GroupChat` or `ChatRoom` message creation for
  these routes.

Current JMeter coverage decision:

- Use peer text-message payloads for positive coverage in this task.
- Do not treat these samplers as coverage for group or room message creation.

Later measured app work:

- Update `createMessage` to use `chatType`, `conversationType`, or `convType`
  from JMeter input.
- Support peer, group, and room message creation consistently.

### ChatManager.updateMessage Message Type

Affected route:

- `ChatManager.updateMessage`

Current wrapper behavior:

- The wrapper creates a new peer text message and calls `updateMessage`.
- It does not support the newer SDK behavior where all message types can be
  updated.

Current JMeter coverage decision:

- Use a peer text-message payload for positive coverage in this task.
- Do not claim full message-type coverage for `updateMessage`.

Later measured app work:

- Update the wrapper to support all message types accepted by the SDK.
- Reuse or extend the same message creation logic used by `sendMessage` and
  `insertMessage`.
