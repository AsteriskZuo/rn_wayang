# JMeter Positive API Coverage Record

## Context

This record captures issues discovered while adding positive JMeter coverage for
the generated Chat SDK routes.

The current implementation task did not modify `measured_app`. This record keeps
the observed measured-app limitations for a later task.

## Follow-Up Items

### ChatGroupManager Shared File APIs

Affected routes:

- `ChatGroupManager.uploadGroupSharedFile`
- `ChatGroupManager.downloadGroupSharedFile`

Current wrapper behavior:

- The SDK calls are commented out.
- The wrapper immediately calls `callback(null)` and returns.

### ChatManager.modifyMsgBody

Affected route:

- `ChatManager.modifyMsgBody`

Current wrapper behavior:

- The wrapper passes `info.body as ChatMessageBody` to the SDK.

### ChatManager.sendMessage And insertMessage Chat Type

Affected routes:

- `ChatManager.sendMessage`
- `ChatManager.insertMessage`

Current wrapper behavior:

- `createMessage` always creates `PeerChat` messages.
- JMeter cannot currently request `GroupChat` or `ChatRoom` message creation for
  these routes.

### ChatManager.updateMessage Message Type

Affected route:

- `ChatManager.updateMessage`

Current wrapper behavior:

- The wrapper creates a new peer text message and calls `updateMessage`.
- It does not support the newer SDK behavior where all message types can be
  updated.
