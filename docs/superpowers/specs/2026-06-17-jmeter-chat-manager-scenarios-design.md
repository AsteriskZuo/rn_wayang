# JMeter Chat Manager Scenarios Design

## Context

`measured_app` exposes `react-native-chat-sdk` APIs through WebSocket commands,
and JMeter drives those commands through `forward_server`. Existing JMeter
plans under `jmeter/data/` are API coverage plans. They contain many samplers
in one file and use `User Defined Variables` for values such as `messageId`,
`groupId`, and `threadId`.

That coverage style is useful, but message-related APIs are easier to verify
with closed-loop scenarios. A scenario should create or discover the resources
it needs, extract runtime identifiers from previous API responses, use those
identifiers in later API calls, and clean up the resources it created.

This design starts that scenario style with ChatManager only. Other managers
can adopt the same pattern later.

## Goal

Add a new set of ChatManager scenario JMeter plans that exercise typical
message workflows with runtime data instead of hard-coded message IDs.

Each scenario plan should be independently runnable and should follow this
shape:

1. initialize Chat SDK;
2. log in;
3. discover or create prerequisite data;
4. execute the target ChatManager workflow;
5. clean up data created by the scenario when practical;
6. log out.

Scenario files live under:

```text
jmeter/data/chat-manager/
```

The existing `jmeter/data/rn-sdk-chat-manager.jmx` coverage plan is not changed
by this design.

## Non-Goals

- Do not replace the existing API coverage JMeter plans.
- Do not write runtime IDs back into `.jmx` files.
- Do not require manual edits to `messageId`, `groupId`, `roomId`, or
  `threadId` after every run.
- Do not design scenario suites for GroupManager, ContactManager, RoomManager,
  or other managers in this phase.
- Do not require every ChatManager edge case to be covered before the scenario
  pattern is useful.
- Do not hide prerequisite failures. If a prerequisite API cannot find a needed
  contact, group, room, or message, the scenario should fail.

## Runtime Variables

JMeter scenario plans should keep stable placeholders in the `.jmx` files and
update their values at runtime.

For simple response shapes, use JSON Extractor where it is clear and reliable.
For nested, variant, or SDK-specific response shapes, use a JSR223
PostProcessor and write variables with `vars.put(...)`.

Examples of runtime variables:

```text
contactUserId
conversationId
messageId
messageIds
groupId
groupMessageId
roomId
threadId
```

Runtime variables work in both JMeter UI and CLI runs. They exist only for the
current run and are not saved back to the `.jmx` file. This keeps Git diffs
stable while allowing later samplers to use values produced by earlier
samplers.

Variables must be set before the samplers that use them. The first scenario
suite should keep one thread and sequential execution so variable flow is
predictable.

## Prerequisite Resource Discovery

Scenario plans should prefer API-driven prerequisite discovery over long-lived
hard-coded resource IDs.

The first ChatManager phase may use these existing commands:

- `ChatContactManager.getAllContactsFromServer` to discover a contact target
  for peer messages.
- `ChatGroupManager.getJoinedGroups` to discover a group target for group
  messages and thread parent messages.
- `ChatRoomManager.fetchPublicChatRoomsFromServer` to discover a chat room
  target for room messages.
- `ChatManager.createChatThread` to create a thread after a suitable parent
  group message exists.

If one of these prerequisite discovery steps returns no usable resource, the
scenario should fail. That failure indicates the account or environment is not
ready for the scenario, or that the prerequisite API itself is not working.

Prerequisite extraction must fail fast. If a post-processor cannot extract a
required value such as `contactUserId`, `groupId`, `roomId`, `messageId`, or
`threadId`, it should mark the current sampler failed and stop the current
JMeter thread so later samplers do not call SDK APIs with empty variables.

Use a consistent failure shape in JSR223 post-processors:

```groovy
prev.setSuccessful(false)
prev.setResponseCode('PRECONDITION_FAILED')
prev.setResponseMessage(
  'PRECONDITION_FAILED: message-thread-management requires groupId, but ChatGroupManager.getJoinedGroups returned no joined group'
)
prev.setResponseData(
  'PRECONDITION_FAILED: message-thread-management requires groupId, but ChatGroupManager.getJoinedGroups returned no joined group',
  'UTF-8'
)
ctx.getThread().stop()
```

`responseMessage` should contain a concise, complete reason. `responseData`
may include more detailed extraction context, such as the source API response,
the JSON path or script branch used, and the missing variable name.

Stopping the current JMeter thread is acceptable for precondition failures. The
next thread or next run should establish its own connection, initialize the SDK,
and log in again. This design still leaves one execution-structure decision open:
whether scenario plans should keep init/login/logout as normal samplers inside
each scenario thread, or move init/login to a setUp Thread Group and logout to a
tearDown Thread Group. That choice should be confirmed before implementing the
first scenario template, because it affects cleanup visibility and how failures
are reported.

## Failure Analysis

**Do not change tests, assertions, or measured app code until the failure is
classified.**

Scenario failures must be analyzed and classified before changing test data,
loosening assertions, or modifying measured app code. A failed JMeter sampler
does not automatically mean the scenario is wrong, and it does not
automatically mean the measured app or SDK is broken.

When a scenario fails during implementation or verification, first classify the
failure into one of these categories:

- environment or account state, such as missing contacts, no joined groups, no
  public chat rooms, expired login state, or missing paid feature entitlement;
- test setup or JMeter scenario defect, such as extracting the wrong response
  field, using a variable before it is set, or using the wrong timestamp
  boundary;
- measured app wrapper defect, such as sending the wrong field name, using the
  wrong SDK enum, or mishandling the unified callback response;
- expected SDK or service business behavior, such as a feature not enabled for
  the account or a resource not found after an intentional delete operation;
- suspected SDK bug, where the request is valid, the environment is ready, and
  the observed SDK behavior contradicts the SDK contract or stable prior
  behavior.

For significant failures or failures that would require changing scenario
semantics, wrapper behavior, or assertions, pause and confirm the proposed
classification and fix direction with the user before proceeding.

## Scenario Categories

The first ChatManager scenario suite should use ten high-level categories.
This document intentionally keeps them at category level first. Each category
can be expanded with detailed sampler chains as it is discussed and
implemented.

### 1. Basic Message Lifecycle

File:

```text
jmeter/data/chat-manager/message-basic-lifecycle.jmx
```

Purpose:

Verify the core peer-message lifecycle using runtime IDs and explicit
ChatManager APIs:

1. `ChatContactManager.getAllContactsFromServer`
   - Extract `contactUserId`.
   - Set `conversationId` to the selected contact ID.
2. `ChatManager.sendMessage`
   - Send a peer text message to `contactUserId`.
   - Extract `messageId`.
   - Set `messageIds` to the extracted `messageId`.
3. `ChatManager.getMessage`
   - Use `messageId`.
   - Expect the sent message to be returned.
4. `ChatManager.modifyMsgBody`
   - Use `messageId`.
   - Update the message body to a known new text value.
   - Use a runtime `body` object extracted from a previous
     `ChatManager.getMessage` response instead of hand-building an incomplete
     body shape. The JMeter plan may keep `body` as a user-defined placeholder,
     then replace it at runtime by extracting the whole message body object,
     changing the text payload, and passing that object to `modifyMsgBody`.
5. `ChatManager.getMessage`
   - Use the same `messageId`.
   - Expect the updated message body.
6. `ChatManager.deleteMessage`
   - Use `conversationId`, `conversationType`, and `messageId`.
   - Verify local message deletion as part of the lifecycle scenario. This is
     a target API check, not generic cleanup.
7. `ChatManager.getMessage`
   - Use the same `messageId`.
   - Expect the locally deleted message to be unavailable from local message
     lookup. The SDK's exact behavior after local deletion is not fixed by this
     design: it may return `null`, return an error object through the unified
     response wrapper, or reject through the wrapper's normal error path. The
     scenario assertion should be explicit about the behavior observed during
     implementation and must verify that the original message object is not
     still returned as an available local message.

This category establishes the base dynamic-variable pattern used by later
scenarios.

### 2. Send Message Types

File:

```text
jmeter/data/chat-manager/message-send-types.jmx
```

Purpose:

Verify `ChatManager.sendMessage` across message content types with explicit
ChatManager APIs.

This category focuses on message body and attachment type, not target object
type. The target should be a peer conversation discovered through contacts.

Prerequisite flow:

1. `ChatContactManager.getAllContactsFromServer`
   - Extract `contactUserId`.
   - Set `conversationId` to the selected contact ID.
   - Set `conversationType` to `PeerChat`.

Each send-type case should follow this shape:

1. `ChatManager.sendMessage`
   - Send one message of the target type to `contactUserId`.
   - Extract a type-specific runtime ID such as `textMessageId`,
     `imageMessageId`, or `largeFileMessageId`.
2. `ChatManager.getMessage`
   - Use the type-specific message ID.
   - Verify the returned message has the expected message type and key payload
     fields.
3. Keep the sent message available for normal account history. Do not call
   `ChatManager.deleteMessage` as cleanup in this scenario.

The scenario should include these send-type cases:

- text message:
  `ChatManager.sendMessage(type=text, username=${contactUserId}, content=...)`;
- image message:
  `ChatManager.sendMessage(type=image, username=${contactUserId}, fixtureName=test-image.jpg)`;
- file message:
  `ChatManager.sendMessage(type=file, username=${contactUserId}, fixtureName=test-file.txt, displayName=...)`;
- large file message:
  `ChatManager.sendMessage(type=file, username=${contactUserId}, fixtureName=test-large-8mb.bin, displayName=...)`;
- voice message:
  `ChatManager.sendMessage(type=voice, username=${contactUserId}, fixtureName=test-audio.m4a, displayName=..., duration=...)`;
- video message:
  `ChatManager.sendMessage(type=video, username=${contactUserId}, fixtureName=test-video.mp4, displayName=...)`;
- location message:
  `ChatManager.sendMessage(type=location, username=${contactUserId}, latitude=..., longitude=...)`;
- command message:
  `ChatManager.sendMessage(type=cmd, username=${contactUserId}, action=...)`;
- custom message:
  `ChatManager.sendMessage(type=custom, username=${contactUserId}, event=..., data={...})`.

Attachment-based messages should use measured app fixture support instead of
host machine paths.

This scenario should also include one negative sendMessage regression case for
an invalid attachment local path:

1. `ChatManager.sendMessage`
   - Send `type=file` with `localPath` set to a native path that does not
     exist.
   - Verify the request returns through the normal WebSocket response path with
     a clear SDK file/path error.
   - The top-level response should still follow the unified API response shape
     with `"ok":true`; the expected SDK failure is judged from `value`.

This negative case verifies that an invalid file input reaches the SDK send
path, fails predictably, and does not leave the WebSocket request hanging.

### 3. Message Query

File:

```text
jmeter/data/chat-manager/message-query.jmx
```

Purpose:

Create messages with known runtime content and verify message retrieval APIs
that query by ID, keyword, type, time, conversation, or count.

This category covers query semantics. It should create multiple messages so
list and search APIs have meaningful data to return. The target should remain a
peer conversation discovered through contacts.

Prerequisite and data setup flow:

1. `ChatContactManager.getAllContactsFromServer`
   - Extract `contactUserId`.
   - Set `conversationId` to the selected contact ID.
   - Set `conversationType` to `PeerChat`.
2. Generate a unique JMeter variable `queryKeyword`, such as
   `jmeter-query-${__time()}`.
3. `ChatManager.sendMessage`
   - Send `type=text` with content containing `queryKeyword`.
   - Extract `queryTextMessageId1`.
4. `ChatManager.sendMessage`
   - Send a second `type=text` message with content containing `queryKeyword`.
   - Extract `queryTextMessageId2`.
5. `ChatManager.sendMessage`
   - Send `type=image` with `fixtureName=test-image.jpg`.
   - Extract `queryImageMessageId`.
6. Set `messageIds` to
   `queryTextMessageId1,queryTextMessageId2,queryImageMessageId`.
7. Set `startTime`, `endTime`, and `timestamp` so time-window queries include
   the messages created by the scenario.

The scenario should include these query cases:

1. `ChatManager.getMessage`
   - Use `queryTextMessageId1`.
   - Verify the returned message is the expected runtime-created text message.
2. `ChatManager.getMessagesWithIds`
   - Use `conversationId`, `conversationType`, and `messageIds`.
   - Verify the response contains the runtime-created messages.
3. `ChatManager.getMsgs`
   - Use `conversationId`, `conversationType`, `startMsgId`,
     `direction`, `loadCount`, and `isChatThread=false`.
   - Verify a list response is returned and can include the scenario messages.
4. `ChatManager.getMsgsWithMsgType`
   - Query `msgType=txt`.
   - Verify the response contains at least one runtime-created text message.
5. `ChatManager.getMsgsWithMsgType`
   - Query `msgType=img`.
   - Verify the response contains the runtime-created image message when the
     SDK returns it in the selected direction and time window.
6. `ChatManager.getConvMsgsWithKeyword`
   - Use `conversationId`, `conversationType`, `keywords=${queryKeyword}`,
     `direction`, `timestamp`, `count`, `sender`, `searchScope=all`, and
     `isChatThread=false`.
   - Verify the response contains messages with `queryKeyword`.
7. `ChatManager.getMsgsWithKeyword`
   - Use `keywords=${queryKeyword}`, `timestamp`, `maxCount`, `from`,
     `direction`, and `searchScope=all`.
   - Verify the global keyword search response contains a scenario message when
     the SDK returns local results for the selected account.
8. `ChatManager.getConvsMsgsWithKeyword`
   - Use `keywords=${queryKeyword}`, `timestamp`, `maxCount`, `from`,
     `direction`, and `searchScope=all`.
   - Verify the cross-conversation keyword search response contains a scenario
   message when the SDK returns local results for the selected account.
9. `ChatManager.getMsgWithTimestamp`
   - Use `conversationId`, `conversationType`, `startTime`, `endTime`,
     `direction`, `count`, and `isChatThread=false`.
   - Verify the response contains messages from the scenario's time window.
10. `ChatManager.getMessageCountWithTimestamp`
    - Use `conversationId`, `conversationType`, `start`, `end`, and
      `isChatThread=false`.
    - Verify the response succeeds and, if the SDK result is numeric, is at
      least the number of scenario messages expected in the time window.
11. `ChatManager.searchMessages`
    - Use `msgTypes=txt,img`, `timestamp`, `count`, `from`, `direction`, and
      `isChatThread=false`.
    - Verify the response contains scenario messages when returned by the SDK.
12. `ChatManager.searchMessagesInConversation`
    - Use `conversationId`, `conversationType`, `msgTypes=txt,img`,
      `timestamp`, `count`, `from`, `direction`, and `isChatThread=false`.
    - Verify the response contains scenario messages from the target
      conversation.
13. `ChatManager.fetchHistoryMessagesByOptions`
    - Use `conversationId`, `conversationType`, empty `cursor`, `pageSize=20`,
      and `options={}`.
    - Verify the response succeeds. Do not require this response to contain the
      just-sent messages unless implementation testing shows server history
      synchronization is stable enough.
14. `ChatManager.getMessageCount`
    - Verify the response succeeds.

This scenario does not call `ChatManager.deleteMessage` as cleanup. Query data
messages can remain in normal account history.

`msgType` and `msgTypes` must use the SDK's real input values for these
parameters. For text and image query APIs, use `txt` and `img`; do not use
send-message helper names such as `text` or `image` for these fields.

### 4. Recall And Delete

File:

```text
jmeter/data/chat-manager/message-recall-delete.jmx
```

Purpose:

Verify message recall and deletion paths with messages created during the
scenario.

This category should keep recall, local deletion, timestamp deletion, and
server-side removal separate enough that a failed sampler identifies which
behavior broke. Each case should create the message data it needs so one delete
operation does not invalidate later cases.

Prerequisite flow:

1. `ChatContactManager.getAllContactsFromServer`
   - Extract `contactUserId`.
   - Set `conversationId` to the selected contact ID.
   - Set `conversationType` to `PeerChat`.
   - Set `isChatThread` to `false`.

The scenario should include these recall and delete cases:

1. Local single-message deletion:
   - `ChatManager.sendMessage`
     - Send `type=text` with unique content.
     - Extract `localDeleteMessageId`.
   - `ChatManager.getMessage`
     - Use `localDeleteMessageId` and verify the message exists locally.
   - `ChatManager.deleteMessage`
     - Use `conversationId`, `conversationType`, and
       `localDeleteMessageId`.
     - Verify the API succeeds.
   - `ChatManager.getMessage`
     - Use `localDeleteMessageId`.
     - Verify the locally deleted message is unavailable from local lookup.
       The exact SDK response shape should be based on implementation
       observation.
2. Local time-range deletion:
   - Record `localRangeStartTime`.
   - `ChatManager.sendMessage`
     - Send `type=text` with unique content.
     - Extract `localRangeDeleteMessageId`.
   - Record `localRangeEndTime`.
   - `ChatManager.deleteMessagesWithTimestamp`
     - Use `conversationId`, `conversationType`, `startTime`,
       `endTime`, and `isChatThread=false`.
     - Verify the API succeeds.
   - `ChatManager.getMessage`
     - Use `localRangeDeleteMessageId`.
     - Verify the locally deleted message is unavailable from local lookup.
3. Local delete-before-timestamp safety check:
   - `ChatManager.sendMessage`
     - Send `type=text` with unique content.
     - Extract `deleteBeforeMessageId` and the sent message server timestamp.
   - Set `safeBeforeTimestamp` to the sent message server timestamp minus 1.
   - `ChatManager.deleteMessagesBeforeTimestamp`
     - Use `timestamp=${safeBeforeTimestamp}`.
     - Verify the API succeeds.
   - `ChatManager.getMessage`
     - Use `deleteBeforeMessageId`.
     - Verify the just-sent message still exists locally, proving the
       delete-before operation did not delete messages at or after the sent
       message timestamp.
4. Remote recall:
   - `ChatManager.sendMessage`
     - Send `type=text` with unique content.
     - Extract `recallMessageId`.
   - `ChatManager.recallMessage`
     - Use `recallMessageId`.
     - Verify the API succeeds.
   - `ChatManager.getMessage`
     - Use `recallMessageId`.
     - Verify the message state matches the SDK's observed recall behavior.
       Do not assume the design knows whether the SDK returns `null`, an error
       object, or a recalled-message state.
5. Server removal by message IDs:
   - `ChatManager.sendMessage`
     - Send `type=text` with unique content.
     - Extract `serverRemoveMessageId`.
     - Set `serverRemoveMessageIds` to `serverRemoveMessageId`.
   - `ChatManager.removeMessagesFromServerWithMsgIds`
     - Use `conversationId`, `conversationType`, `serverRemoveMessageIds`,
       and `isChatThread=false`.
     - Verify the API succeeds.
   - `ChatManager.fetchHistoryMessagesByOptions`
     - Use `conversationId`, `conversationType`, empty `cursor`,
       `pageSize=20`, and `options={}`.
     - Verify the fetched server history does not include
       `serverRemoveMessageId`, allowing for any SDK-specific response shape
       observed during implementation.
6. Server removal by timestamp:
   - Record `serverRemoveTimestamp`.
   - `ChatManager.sendMessage`
     - Send `type=text` with unique content after `serverRemoveTimestamp`.
     - Extract `serverRangeMessageId`.
   - `ChatManager.removeMessagesFromServerWithTimestamp`
     - Use `conversationId`, `conversationType`, `serverRemoveTimestamp`,
       and `isChatThread=false`.
     - Verify the API succeeds.
   - `ChatManager.fetchHistoryMessagesByOptions`
     - Use `conversationId`, `conversationType`, empty `cursor`,
       `pageSize=20`, and `options={}`.
     - Verify the fetched server history no longer includes messages removed
       by the timestamp operation, including `serverRangeMessageId` when the
       SDK/server timestamp semantics make it eligible for removal.
7. Local conversation-message deletion:
   - `ChatManager.sendMessage`
     - Send `type=text` with unique content.
     - Extract `deleteConversationAllMessageId`.
   - `ChatManager.deleteConversationAllMessages`
     - Use `conversationId`, `conversationType`, and `isChatThread=false`.
     - Verify the API succeeds.
   - `ChatManager.getMessage`
     - Use `deleteConversationAllMessageId`.
     - Verify the local message is unavailable from local lookup.

Do not include `ChatManager.removeConversationFromServer` in this scenario; it
belongs to the conversation scenario.

### 5. Translation

File:

```text
jmeter/data/chat-manager/message-translation.jmx
```

Purpose:

Verify translation-related ChatManager APIs using a text message created during
the scenario.

Translation is a paid or separately enabled capability. Translation failures
must follow the global failure analysis process before changing code or
weakening assertions.

The scenario should fetch supported languages where useful, translate a
runtime-created message, and verify the translated message can still be
retrieved when translation is enabled for the test account.

The scenario flow should be:

1. `ChatContactManager.getAllContactsFromServer`
   - Extract `contactUserId`.
   - Set `conversationId` to the selected contact ID.
   - Set `conversationType` to `PeerChat`.
2. `ChatManager.fetchSupportedLanguages`
   - Verify the API succeeds when the account has access to translation
     metadata.
   - Optionally verify the configured target language, such as `en`, appears
     in the response if the response shape supports that assertion.
3. `ChatManager.sendMessage`
   - Send `type=text` with translatable content.
   - Extract `translationMessageId`.
4. `ChatManager.translateMessage`
   - Use `translationMessageId`.
   - Pass the current wrapper field `lanuages`, matching the existing
     measured app API spelling.
   - Verify success only when the environment is known to have translation
     enabled. If it fails, classify the error before treating it as a test or
     code defect.
5. `ChatManager.getMessage`
   - Use `translationMessageId`.
   - Verify the message can still be retrieved.
   - If translation succeeded, verify the translated result exists using the
     response shape observed during implementation.

### 6. Reaction

File:

```text
jmeter/data/chat-manager/message-reaction.jmx
```

Purpose:

Verify reaction workflows against runtime-created messages.

The scenario should use a peer text message as the reaction target.

Prerequisite and target message flow:

1. `ChatContactManager.getAllContactsFromServer`
   - Extract `contactUserId`.
   - Set `conversationId` to the selected contact ID.
   - Set `conversationType` to `PeerChat`.
   - Set `chatType` to `PeerChat`.
2. Generate a unique `reaction`, such as `jmeter-reaction-${__time()}`.
3. `ChatManager.sendMessage`
   - Send `type=text` with unique content.
   - Extract `reactionMessageId`.
   - Set `messageId` and `messageIds` to `reactionMessageId`.
4. `ChatManager.getMessage`
   - Verify the target message exists.

The scenario should include these reaction cases:

1. `ChatManager.addReaction`
   - Use `messageId` and `reaction`.
   - Verify the API result in `value`.
2. `ChatManager.getReactionList`
   - Use `messageId`.
   - Verify the local reaction list contains `reaction` when the SDK exposes
     it in the observed response shape.
3. `ChatManager.fetchReactionDetail`
   - Use `messageId`, `reaction`, empty `cursor`, and `pageSize=20`.
   - Verify the API result and reaction detail when available.
4. `ChatManager.fetchReactionList`
   - Use `messageIds`, `chatType=PeerChat`, and omit or leave `groupId` empty.
   - If implementation shows this SDK API only supports group messages, follow
     the global failure analysis process and move or duplicate this case into
     the group/thread target scenario rather than weakening the assertion
     silently.
5. `ChatManager.removeReaction`
   - Use `messageId` and `reaction`.
   - Verify the API result in `value`.
6. `ChatManager.getReactionList`
   - Use `messageId`.
   - Verify `reaction` is no longer present for the current user when the SDK
     response shape supports that assertion.

### 7. Pin

File:

```text
jmeter/data/chat-manager/message-pin.jmx
```

Purpose:

Verify pin workflows against runtime-created messages.

The scenario should use a peer text message as the pin target.

Prerequisite and target message flow:

1. `ChatContactManager.getAllContactsFromServer`
   - Extract `contactUserId`.
   - Set `conversationId` to the selected contact ID.
   - Set `conversationType` to `PeerChat`.
   - Set `isChatThread` to `false`.
2. `ChatManager.sendMessage`
   - Send `type=text` with unique content.
   - Extract `pinMessageId`.
   - Set `messageId` to `pinMessageId`.
3. `ChatManager.getMessage`
   - Verify the target message exists.

The scenario should include these pin cases:

1. `ChatManager.pinMessage`
   - Use `messageId`.
   - Verify the API result in `value`.
2. `ChatManager.getMessagePinInfo`
   - Use `messageId`.
   - Verify pin information is returned when the SDK response shape supports
     that assertion.
3. `ChatManager.getPinnedMessages`
   - Use `conversationId`, `conversationType`, and `isChatThread=false`.
   - Verify the local pinned-message response contains `messageId`.
4. `ChatManager.fetchPinnedMessages`
   - Use `conversationId`, `conversationType`, and `isChatThread=false`.
   - Verify the API result. If server synchronization is stable during
     implementation, also verify the response contains `messageId`.
5. `ChatManager.unpinMessage`
   - Use `messageId`.
   - Verify the API result in `value`.
6. `ChatManager.getPinnedMessages`
   - Use `conversationId`, `conversationType`, and `isChatThread=false`.
   - Verify `messageId` is no longer returned as a pinned message when the SDK
     response shape supports that assertion.

### 8. Conversation

File:

```text
jmeter/data/chat-manager/message-conversation.jmx
```

Purpose:

Verify conversation-related ChatManager APIs after a message establishes a
conversation.

This category should focus on conversation APIs, not message deletion,
reaction, or message pinning.

Prerequisite and conversation setup flow:

1. `ChatContactManager.getAllContactsFromServer`
   - Extract `contactUserId`.
   - Set `conversationId` to the selected contact ID.
   - Set `conversationType` to `PeerChat`.
   - Set `convIds` to the selected contact ID.
   - Set `isChatThread` to `false`.
2. `ChatManager.sendMessage`
   - Send `type=text` with unique content.
   - Extract `conversationMessageId`.
   - Set `messageId` to `conversationMessageId`.

The scenario should include these conversation cases:

1. `ChatManager.getConversation`
   - Use `conversationId`, `conversationType`, and `createIfNeed=true`.
   - Verify a conversation is returned.
2. `ChatManager.getAllConversations`
   - Verify the API result.
   - If the response shape is stable, verify the list contains
     `conversationId`.
3. `ChatManager.getLatestMessage`
   - Use `conversationId`, `conversationType`, and `isChatThread=false`.
   - Verify the latest-message result, ideally matching
     `conversationMessageId` when the SDK returns the just-sent message.
4. `ChatManager.getLatestReceivedMessage`
   - Use `conversationId` and `conversationType`.
   - Verify the API result. Do not require this to equal the just-sent message,
     because the just-sent message is outgoing.
5. `ChatManager.getUnreadCount`
   - Verify the API result.
6. `ChatManager.getConversationUnreadCount`
   - Use `conversationId` and `conversationType`.
   - Verify the API result.
7. `ChatManager.getConversationMessageCount`
   - Use `conversationId`, `conversationType`, and `isChatThread=false`.
   - Verify the API result. If the SDK returns a numeric count, verify it is
     compatible with the scenario-created conversation.
8. `ChatManager.markMessageAsRead`
   - Use `conversationId`, `conversationType`, and `messageId`.
   - Verify the API result.
9. `ChatManager.markAllMessagesAsRead`
   - Use `conversationId` and `conversationType`.
   - Verify the API result.
10. `ChatManager.sendConversationReadAck`
    - Use `conversationId`.
    - Verify the API result.
11. `ChatManager.setConversationExtension`
    - Use `conversationId`, `conversationType`, and a dictionary such as
      `dict={"source":"jmeter","scenario":"conversation"}`. The current
      measured app wrapper reads the extension payload from `info.dict`.
    - Verify the API result.
12. `ChatManager.getConversation`
    - Use `conversationId`, `conversationType`, and `createIfNeed=true`.
    - Verify the conversation extension when the SDK response shape supports
      that assertion.
13. `ChatManager.pinConversation`
    - Use `conversationId` and `isPinned=true`.
    - Verify the API result.
14. `ChatManager.fetchPinnedConversationsFromServerWithCursor`
    - Use empty `cursor` and `pageSize=20`.
    - Verify the API result. If server synchronization is stable, verify the
      response contains `conversationId`.
15. `ChatManager.pinConversation`
    - Use `conversationId` and `isPinned=false`.
    - Verify the API result.
16. `ChatManager.addRemoteAndLocalConversationsMark`
    - Use `convIds` and a numeric mark such as `mark=0`.
    - Verify the API result.
17. `ChatManager.fetchConversationsByOptions`
    - Use the same mark and pagination fields.
    - Verify the API result. If the response shape is stable, verify it
      contains `conversationId`.
18. `ChatManager.deleteRemoteAndLocalConversationsMark`
    - Use `convIds` and the same mark.
    - Verify the API result.
19. `ChatManager.fetchConversationsFromServerWithCursor`
    - Use empty `cursor` and `pageSize=20`.
    - Verify the API result. If server synchronization is stable, verify the
      response contains `conversationId`.
20. `ChatManager.deleteConversation`
    - Use `conversationId` and `withMessage=0`.
    - Verify local conversation deletion.
21. `ChatManager.getConversation`
    - Use `conversationId`, `conversationType`, and `createIfNeed=false`.
    - Verify the local conversation is unavailable, using the SDK response
      shape observed during implementation.
22. `ChatManager.removeConversationFromServer`
    - Use `conversationId`, `conversationType`, and
      `isDeleteServerMessages=false`.
    - Verify the API result.

Do not include `ChatManager.deleteAllMessageAndConversation` in this scenario.
It is a global destructive API and should only be considered later as an
explicitly labeled maintenance or destructive scenario.

### 9. Target Types

File:

```text
jmeter/data/chat-manager/message-target-types.jmx
```

Purpose:

Verify `ChatManager.sendMessage` behavior across target object types.

This category focuses on where a message is sent, not on message body type.
The default body can be a simple text message.

Target types include:

- peer contact;
- joined group;
- public chat room;
- chat thread.

Implementation prerequisite:

`BizChatManager.createMessage` must not hardcode
`ChatMessageChatType.PeerChat` for every outgoing message. `PeerChat` may remain
the default when no target type is provided, but `ChatManager.sendMessage` must
construct messages with `createChatType(info)` so peer, group, chat room, and
thread targets use the actual requested chat type. It must also preserve
`isChatThread` for thread messages. This is a prerequisite for this scenario:
fix the measured app wrapper before using JMeter results as SDK behavior for
group, room, or thread sends.

The scenario should include these target-type cases:

1. Peer contact:
   - `ChatContactManager.getAllContactsFromServer`
     - Extract `contactUserId`.
   - `ChatManager.sendMessage`
     - Use `type=text`, `username=${contactUserId}`, `chatType=PeerChat`, and
       unique content.
     - Extract `peerMessageId`.
   - `ChatManager.getMessage`
     - Verify the peer message can be retrieved.
2. Joined group:
   - `ChatGroupManager.getJoinedGroups`
     - Extract `groupId`.
   - `ChatManager.sendMessage`
     - Use `type=text`, `username=${groupId}`, `chatType=GroupChat`, and
       unique content.
     - Extract `groupMessageId`.
   - `ChatManager.getMessage`
     - Verify the group message can be retrieved.
   - `ChatManager.getLatestMessage`
     - Use `conversationId=${groupId}`, `conversationType=GroupChat`, and
       `isChatThread=false`.
     - Verify the group conversation can return a latest message.
3. Public chat room:
   - `ChatRoomManager.fetchPublicChatRoomsFromServer`
     - Extract `roomId`.
   - `ChatRoomManager.joinChatRoom`
     - Join `roomId` before sending the room message.
   - `ChatManager.sendMessage`
     - Use `type=text`, `username=${roomId}`, `chatType=ChatRoom`, and unique
       content.
     - Extract `roomMessageId`.
   - `ChatManager.getMessage`
     - Verify the room message can be retrieved.
   - `ChatRoomManager.leaveChatRoom`
     - Leave `roomId` after the room message check.
4. Chat thread message:
   - Create or obtain a thread using the thread-management scenario flow.
   - `ChatManager.sendMessage`
     - Use `type=text`, `username=${threadId}`, `chatType=GroupChat`,
       `isChatThread=true`, and unique content.
     - Extract `threadMessageId`.
   - `ChatManager.getMessage`
     - Verify the thread message can be retrieved.

### 10. Thread Management

File:

```text
jmeter/data/chat-manager/message-thread-management.jmx
```

Purpose:

Verify chat thread lifecycle and query APIs. This category focuses on thread
management, not on comparing target message types.

Thread scenarios should create a thread dynamically. The scenario flow should
be:

1. discover a joined group;
   - `ChatGroupManager.getJoinedGroups`
   - Extract `threadParentGroupId`.
2. send a parent group message;
   - `ChatManager.sendMessage`
   - Use `type=text`, `username=${threadParentGroupId}`,
     `chatType=GroupChat`, and unique content.
   - Extract `threadParentMessageId`.
3. create the thread;
   - `ChatManager.createChatThread`
   - Use `name`, `msgId=${threadParentMessageId}`, and
     `groupId=${threadParentGroupId}`.
   - Extract `threadId`.
4. `ChatManager.fetchChatThreadFromServer`
   - Use `threadId`.
   - Verify the thread can be fetched from the server.
5. `ChatManager.getMessageThread`
   - Use `messageId=${threadParentMessageId}`.
   - Verify the parent message is associated with the created thread when the
     SDK response shape supports that assertion.
6. `ChatManager.getThreadConversation`
   - Use `threadId` and `createIfNeed=true`.
   - Verify the thread conversation can be retrieved.
7. `ChatManager.fetchMembersWithChatThreadFromServer`
   - Use `threadId`, empty `cursor`, and `pageSize=20`.
   - Verify the member list API result.
8. `ChatManager.fetchChatThreadWithParentFromServer`
   - Use `groupId=${threadParentGroupId}`, empty `cursor`, and `pageSize=20`.
   - Verify the parent thread list API result.
9. `ChatManager.fetchJoinedChatThreadWithParentFromServer`
   - Use `groupId=${threadParentGroupId}`, empty `cursor`, and `pageSize=20`.
   - Verify the joined thread list for the parent group.
10. `ChatManager.fetchJoinedChatThreadFromServer`
    - Use empty `cursor` and `pageSize=20`.
    - Verify the joined thread list API result.
11. `ChatManager.fetchLastMessageWithChatThread`
    - Use `threadIds=${threadId}`.
    - Verify the API result.
12. `ChatManager.updateChatThreadName`
    - Use `threadId` and a new `subject`.
    - Verify the API result.
13. `ChatManager.destroyChatThread`
    - Use `threadId`.
    - Verify the API result.

Do not include `ChatManager.removeMemberWithChatThread` in the first scenario.
It needs an additional member and should be covered later by a multi-user
thread scenario.

## Assertions

All active samplers should assert the unified response success shape where the
request is expected to reach a measured app API wrapper:

```text
"ok":true
```

In this protocol, `"ok":true` means the WebSocket request reached a target API
wrapper and returned an API result. It does not mean the SDK operation
succeeded. SDK failures, business errors, and callback `onError` values are
returned inside `value`. Scenario assertions must inspect `value` to determine
the expected SDK or business outcome.

Errors outside API invocation are protocol errors, not SDK results. Examples
include invalid JSON, invalid `cmd`, or unknown commands. The current measured
app unified response protocol represents those cases with a `protocol_error`
response shape, not `ok:false`.

Scenarios that intentionally verify deletion, recall, or removal may need a
different assertion. Those cases should make the observed SDK behavior explicit
during implementation rather than assuming a specific shape in the design.
Acceptable outcomes may include `null` values or SDK error objects, but the
assertion must prove the target is no longer available in the state expected
after that specific API.

Variable extraction should fail loudly. If a required runtime variable cannot
be extracted, the scenario should fail before later samplers send requests with
empty or stale IDs.

## Cleanup

Scenarios should clean up durable resources they create when the SDK exposes a
practical cleanup operation. Examples include groups, rooms, and chat threads.

Messages are not treated as resources that every scenario must clean up.
`ChatManager.deleteMessage` only removes a local message, and
`ChatManager.recallMessage` changes remote message state. Message deletion and
recall should be tested in their dedicated scenarios, not used as generic
cleanup for send, query, translation, reaction, or pin scenarios.

Cleanup should not mask the primary scenario result. If a cleanup action fails,
JMeter should still report that failure, but the plan should keep sampler names
clear enough to identify whether the failure came from the target behavior or
cleanup.

## README Updates

`jmeter/README.md` already documents running one `.jmx` file and running all
top-level plans under `jmeter/data/*.jmx`.

After scenario files are added under `jmeter/data/chat-manager/`, the README
should add a recursive or nested execution example so both top-level coverage
plans and scenario plans can be run from the command line.
