# Dispatch SDK API Alignment Design

## Purpose

Prepare `measured_app` for full JMeter coverage by making the remote command protocol match the `react-native-chat-sdk@1.15.0` API surface.

The current `Dispatch.ts` command names include historical aliases such as `getCurrentUserName`, `fetchSupportLanguages`, `changeRoomName`, and `fetchUserInfoByUserId`. Those names make future JMeter coverage ambiguous because a test case cannot be reliably mapped back to a single SDK API.

This task makes the command surface explicit before adding full JMeter plans:

- `cmd` names for SDK APIs must match the SDK `.d.ts` method names exactly.
- Deprecated SDK APIs are excluded from required implementation and test coverage.
- `Dispatch.ts` is split into manager-specific routing methods so future API additions are maintainable.

## Source Of Truth

The source of truth is the local SDK type declaration set:

```text
measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/*.d.ts
```

Target APIs are public methods that:

- are declared on one of these managers:
  - `ChatClient`
  - `ChatManager`
  - `ChatGroupManager`
  - `ChatRoomManager`
  - `ChatContactManager`
  - `ChatPresenceManager`
  - `ChatPushManager`
  - `ChatUserInfoManager`
- return `Promise<...>`;
- are not marked with `@deprecated`.

Listener registration APIs, delegate helpers, local protocol helpers, and stub compatibility commands are not part of the SDK API coverage target.

## Deprecated API Rule

Deprecated SDK APIs do not need wrappers, dispatch cases, or JMeter tests.

Existing commands that call deprecated SDK APIs should be removed or migrated to active SDK replacements. The new protocol must not expose deprecated API names as normal SDK commands.

Known deprecated calls currently present include:

```text
ChatClient.login
ChatClient.loginWithAgoraToken
ChatManager.fetchAllConversations
ChatManager.fetchConversationsFromServerWithPage
ChatManager.getMessageWithTimestamp
ChatManager.getMessages
ChatManager.getMessagesWithKeyword
ChatManager.getMessagesWithMsgType
ChatGroupManager.createGroup
ChatGroupManager.fetchGroupInfoFromServer
ChatRoomManager.joinChatRoom
```

## Login Exception

`ChatClient.login` is deprecated, but the test system still needs a username/password login step for JMeter setup.

Keep a `login` command as a test infrastructure exception:

- `login` remains available for shared setup flows such as `init -> login -> API -> logout`.
- `login` is not counted as SDK active API coverage.
- `login` is not a precedent for keeping other deprecated commands.
- Token-based login migration is deferred to a separate task because it requires a token source and changes the JMeter setup contract.

`logout` is not deprecated and remains a normal SDK command.

## Compatibility

This change is intentionally not backward compatible.

Old command names are removed instead of kept as aliases. JMeter is the only expected consumer of the command names, and the existing JMeter plans contain only a small starter set. Future JMeter work should use the aligned command names only.

Examples of required command renames:

```text
getCurrentUserName -> getCurrentUsername
accessToken -> getAccessToken
fetchSupportLanguages -> fetchSupportedLanguages
fetchGroupReadAcks -> fetchGroupAcks
loadMessage -> getMessage
loadMessagesWithMsgType -> getMsgsWithMsgType
loadMessages -> getMsgs
loadMessagesWithTime -> getMsgWithTimestamp
lastReceivedMessage -> getLatestReceivedMessage
unReadCount -> getConversationUnreadCount
markAllMessageAsRead -> markAllMessagesAsRead
getConversationsFromServer -> remove, deprecated target
deleteConversationFromServer -> removeConversationFromServer
loadAllConversations -> getAllConversations
getGroupFileListFromServer -> fetchGroupFileListFromServer
deleteGroupSharedFile -> removeGroupSharedFile
updateGroupExt -> updateGroupExtension
getGroupAnnouncementFromServer -> fetchAnnouncementFromServer
getGroupMemberListFromServer -> fetchMemberListFromServer
getGroupSpecificationFromServer -> remove, deprecated target
applyJoinToGroup -> requestToJoinPublicGroup
changeGroupOwner -> changeOwner
addGroupMembers -> addMembers
deleteGroupMembers -> removeMembers
unBlockGroup -> unblockGroup
changeRoomName -> changeChatRoomSubject
changeRoomDescription -> changeChatRoomDescription
changeRoomOwner -> changeOwner
createRoom -> createChatRoom
destroyRoom -> destroyChatRoom
fetchPublicRoomsFromServer -> fetchPublicChatRoomsFromServer
joinRoom -> remove, deprecated target
addRoomAttributes -> addAttributes
removeRoomAttributes -> removeAttributes
subscribePresences -> subscribe
unsubscribePresences -> unsubscribe
getPreferredNotificationLanguage -> fetchPreferredNotificationLanguage
getPushConfigFromServer -> fetchPushOptionFromServer
updatePushNickName -> updatePushNickname
setPushStyle -> updatePushDisplayStyle
fetchUserInfoByUserId -> fetchUserInfoById
updateOwnInfo -> updateOwnUserInfo
```

## Active API Gaps

After excluding deprecated APIs, current coverage is missing these active SDK APIs:

`ChatManager`:

```text
sendGroupMessageReadAck
getConversationMessageCount
updateConversationMessage
deleteMessagesWithTimestamp
deleteConversationAllMessages
deleteMessagesBeforeTimestamp
getMsgsWithMsgType
getMsgs
getConvMsgsWithKeyword
getMsgWithTimestamp
searchMessages
searchMessagesInConversation
```

`ChatGroupManager`:

```text
getGroupWithId
```

The implementation must add wrappers and dispatch cases for these APIs using the aligned command names.

## Dispatch Structure

`Dispatch.ts` should keep one public `dispatch(data, callback)` method that handles protocol-level concerns:

1. reject empty data;
2. parse JSON;
3. log parsed `cmd` and `info`;
4. route to manager-specific dispatch methods;
5. return `false` only when no route handled the command.

Manager routing should be split into private or static helper methods:

```ts
dispatchChatClient(cmd, info, callback)
dispatchChatManager(cmd, info, callback)
dispatchChatGroupManager(cmd, info, callback)
dispatchChatRoomManager(cmd, info, callback)
dispatchChatContactManager(cmd, info, callback)
dispatchChatPresenceManager(cmd, info, callback)
dispatchChatPushManager(cmd, info, callback)
dispatchChatUserInfoManager(cmd, info, callback)
```

Each helper owns only the cases for its matching `Biz*` class. This keeps future manager-level JMeter plans aligned with code structure.

The helpers should return `true` when they handle a command and `false` otherwise. The top-level dispatcher can then short-circuit through them in a fixed order.

## Biz Wrapper Rules

Wrappers should keep the existing thin pattern:

1. extract fields from `info`;
2. normalize simple arrays or enum-like values when needed;
3. call the matching SDK method;
4. use `BizBase.tryCatch(promise, callback, sdkMethod.name)`.

Wrapper method names for SDK APIs should match SDK method names. Deprecated wrapper methods should be removed unless they are needed by the `login` setup exception.

Non-SDK helper methods such as listener registration should not be mixed into the SDK API dispatch table. If they remain necessary for manual testing, they should be explicitly isolated from SDK API coverage in a separate internal section or deferred.

## JMeter Impact

Existing starter JMeter plans are expected to break until they are updated to the new command names. This is acceptable because the plans are not yet the full coverage suite.

The JMeter full-coverage task should start only after this alignment task is complete and validated.

## Validation

Implementation should include scriptable checks:

1. Extract active SDK Promise API names from `.d.ts`, excluding `@deprecated`.
2. Extract SDK command cases from `Dispatch.ts`.
3. Fail if any SDK command name is not in the active SDK API set, except for explicit protocol exceptions such as `init`, `login`, and `logout`.
4. Fail if any active SDK API is missing from the dispatch surface, unless it is deliberately excluded with a documented reason.
5. Confirm there are no duplicate dispatch cases.

Run app static validation from `measured_app`:

```bash
yarn lint
yarn test
```

JMeter CLI validation is not part of this task. It belongs to the later full JMeter coverage task.

## Completion Criteria

This task is complete when:

- `Dispatch.ts` is split by manager.
- SDK API command names match non-deprecated `.d.ts` method names exactly.
- Deprecated SDK API commands are removed except for the `login` setup exception.
- Missing active API wrappers and dispatch cases are added.
- Scriptable API alignment checks pass.
- `yarn lint` and `yarn test` pass in `measured_app`.
