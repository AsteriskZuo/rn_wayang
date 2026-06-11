# RN Chat SDK Biz Dispatch Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]` / `- [x]`) syntax for tracking.

**Goal:** Align `measured_app/src/biz` wrappers and generated dispatch routes with active `react-native-chat-sdk` Promise API names, without preserving historical command aliases.

**Architecture:** SDK declaration method names are the source of truth for Biz wrappers. Biz wrappers expose same-name static methods, and `generate-dispatch-routes.js` emits routes only for active SDK methods that have same-name Biz wrappers. Generated route commands are manager-qualified as `SdkClass.method` (for example `ChatGroupManager.addAdmin`) to avoid collisions between SDK managers. Generated dispatch files log unknown commands using the SDK manager class name when called directly; top-level `Dispatch` suppresses per-route unknown warnings while probing generated routes and logs one final unknown warning only after generated and internal routes all reject the command.

**Current status:** Implemented on branch `2026-06-10-rn-chat-sdk-biz-dispatch-alignment`. Final audit reports 222 active SDK Promise APIs, 269 Biz static methods, 221 generated active routes, no missing active wrappers, no deprecated wrappers present, and no generated dispatch coverage gaps.

**Tech Stack:** React Native TypeScript, Node.js TypeScript compiler API scripts, Yarn Berry, Jest, ESLint.

---

## File Map

- Modify: `measured_app/scripts/generate-dispatch-routes.js`
  - Renders generated dispatch files.
  - Must import `Logger`, emit manager-qualified `case '${manager.sdkClass}.${name}'` routes, accept `logUnknown = true`, and emit `Logger.raw.warn(\`${manager.sdkClass}: unknown cmd: ${cmd}\`)` in every generated default branch when logging is enabled.
- Modify: `measured_app/src/Dispatch.ts`
  - Iterates generated SDK routes with `logUnknown = false`, then falls back to `dispatchInternal`, then logs one top-level unknown command warning.
- Modify: `measured_app/src/dispatch/*.generated.ts`
  - Generated output only. Do not hand-edit except by running `yarn generate:dispatch`.
- Modify: `measured_app/src/dispatch/index.ts`
  - Generated output only.
- Modify: `measured_app/src/biz/BizChatClient.ts`
  - Align `ChatClient` wrappers such as `getAccessToken`, `getCurrentUsername`, and `isConnected`; remove deprecated normal wrappers.
- Modify: `measured_app/src/biz/BizChatGroupManager.ts`
  - Rename old group wrappers to SDK names and add missing active SDK wrappers.
- Modify: `measured_app/src/biz/BizChatManager.ts`
  - Rename old chat/message/thread wrappers to SDK names and add missing active SDK wrappers.
- Modify: `measured_app/src/biz/BizChatPresenceManager.ts`
  - Rename presence wrappers to `subscribe` and `unsubscribe`.
- Modify: `measured_app/src/biz/BizChatPushManager.ts`
  - Rename push wrappers to SDK names and add missing push wrappers.
- Modify: `measured_app/src/biz/BizChatRoomManager.ts`
  - Rename old room wrappers to SDK names and add missing active SDK wrappers.
- Modify: `measured_app/src/biz/BizChatUserInfoManager.ts`
  - Rename user info wrappers to SDK names.
- Reference: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/*.d.ts`
  - Source of SDK method names and signatures.
- Reference: `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`
  - Wrapper rules and validation commands.

## Task 1: Baseline Audit and Script Root Cause Capture

**Files:**
- Read: `measured_app/scripts/generate-dispatch-routes.js`
- Read: `measured_app/src/dispatch/ChatContactManager.generated.ts`
- Read: `measured_app/src/dispatch/ChatGroupManager.generated.ts`

- [x] **Step 1: Capture baseline audit output**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

Expected:

```text
chat sdk api alignment audit
active sdk promise APIs: 222
generated active routes: 125
missing active wrappers:
```

Use the current missing-wrapper and mismatch sections as implementation input.

- [x] **Step 2: Confirm generator behavior**

Read `measured_app/scripts/generate-dispatch-routes.js` and verify `main()` only pushes `routeMethods` when `bizMethods.has(name)` for active SDK method names:

```javascript
for (const name of active) {
  if (bizMethods.has(name)) {
    routeMethods.push(name);
  } else {
    summary.missingWrappers.push(`${manager.sdkClass}.${name}`);
  }
}
```

Expected: old names such as `addGroupAdmin` are not generated because they are not active SDK method names. The fix is Biz method name alignment, not adding old aliases.

- [x] **Step 3: Confirm hand-edited generated file**

Run:

```bash
git diff -- measured_app/src/dispatch/ChatContactManager.generated.ts
```

Expected: the diff shows a manually added `Logger` import and one default-branch warning. This confirms the logging fix belongs in the generator.

## Task 2: Add Generated Unknown-Command Logging

**Files:**
- Modify: `measured_app/scripts/generate-dispatch-routes.js`
- Regenerate: `measured_app/src/dispatch/*.generated.ts`
- Regenerate: `measured_app/src/dispatch/index.ts`

- [x] **Step 1: Update the generated route template**

In `renderGeneratedRoute(manager, routeMethods)`, add `Logger` to the rendered imports, render manager-qualified route cases, and update the default branch.

Expected rendered import block:

```typescript
import {Logger} from '../Logger';
import {ReturnCallback} from '../RNWS';
import {${manager.bizClass}} from '../biz/${manager.bizClass}';
```

Expected rendered route/default pattern:

```typescript
export function ${manager.dispatchName}(
  cmd: string,
  info: any,
  callback: ReturnCallback,
  logUnknown = true,
): boolean {
  switch (cmd) {
    case '${manager.sdkClass}.${name}':
      ${manager.bizClass}.${name}(info, callback);
      return true;
    default:
      if (logUnknown) {
        Logger.raw.warn(`${manager.sdkClass}: unknown cmd: ${cmd}`);
      }
      return false;
  }
}
```

The JavaScript template must escape the inner `${cmd}` so generated TypeScript keeps runtime interpolation:

```javascript
`        Logger.raw.warn(\`${manager.sdkClass}: unknown cmd: \${cmd}\`);`
```

- [x] **Step 2: Regenerate dispatch files**

Run:

```bash
cd measured_app
yarn generate:dispatch
```

Expected:

```text
dispatch route generation complete
generated routes:
```

- [x] **Step 3: Inspect generated diffs**

Run:

```bash
git diff -- measured_app/scripts/generate-dispatch-routes.js measured_app/src/dispatch
```

Expected:

- Every `*.generated.ts` file imports `Logger` from `../Logger`.
- Every generated case is manager-qualified as `${SdkClass}.${method}`.
- Every generated dispatch function accepts `logUnknown = true`.
- Every generated default branch logs `${SdkClass}: unknown cmd: ${cmd}` only when `logUnknown` is true.
- `ChatContactManager.generated.ts` hand edit is replaced by generated formatting, not preserved as a one-off.

## Task 3: Align BizChatClient

**Files:**
- Modify: `measured_app/src/biz/BizChatClient.ts`
- Reference: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/ChatClient.d.ts`

- [x] **Step 1: Read active ChatClient signatures**

Run:

```bash
cd measured_app
rg "^[ ]{4}(getAccessToken|getCurrentUsername|isConnected)\\(" node_modules/react-native-chat-sdk/lib/typescript/src/ChatClient.d.ts -n
```

Expected signatures:

```typescript
isConnected(): Promise<boolean>;
getCurrentUsername(): Promise<string>;
getAccessToken(): Promise<string>;
```

- [x] **Step 2: Rename old wrappers to SDK names**

In `BizChatClient.ts`, replace:

```typescript
static getCurrentUserName(_info: any, callback: ReturnCallback) {
```

with:

```typescript
static getCurrentUsername(_info: any, callback: ReturnCallback) {
```

Replace:

```typescript
static getIsConnected(_info: any, callback: ReturnCallback) {
```

with:

```typescript
static isConnected(_info: any, callback: ReturnCallback) {
```

Replace:

```typescript
static accessToken(info: any, callback: ReturnCallback) {
```

with:

```typescript
static getAccessToken(_info: any, callback: ReturnCallback) {
```

Keep each existing `tryCatch` call and ensure the tag remains the SDK method `.name`.

- [x] **Step 3: Remove deprecated normal wrapper**

Remove `static loginWithAgoraToken(...)` from `BizChatClient.ts`. Keep `loginWithToken(...)`, `renewAgoraToken(...)`, and protocol/internal `login` behavior unchanged.

- [x] **Step 4: Verify ChatClient audit entries**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

Expected: `ChatClient.getAccessToken`, `ChatClient.getCurrentUsername`, and `ChatClient.isConnected` no longer appear under `missing active wrappers`; `ChatClient.loginWithAgoraToken` no longer appears under `deprecated wrappers present`.

## Task 4: Align BizChatGroupManager

**Files:**
- Modify: `measured_app/src/biz/BizChatGroupManager.ts`
- Reference: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/ChatGroupManager.d.ts`

- [x] **Step 1: List group missing wrappers**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api | sed -n '/missing active wrappers:/,/deprecated wrappers present:/p' | rg 'ChatGroupManager'
```

Expected current missing names include:

```text
ChatGroupManager.acceptInvitation
ChatGroupManager.acceptJoinApplication
ChatGroupManager.addAdmin
ChatGroupManager.addAllowList
ChatGroupManager.addMembers
ChatGroupManager.blockMembers
ChatGroupManager.changeOwner
ChatGroupManager.declineInvitation
ChatGroupManager.declineJoinApplication
ChatGroupManager.fetchAllowListFromServer
ChatGroupManager.fetchAnnouncementFromServer
ChatGroupManager.fetchBlockListFromServer
ChatGroupManager.fetchGroupFileListFromServer
ChatGroupManager.fetchMemberListFromServer
ChatGroupManager.fetchMuteListFromServer
ChatGroupManager.isMemberInAllowListFromServer
ChatGroupManager.muteAllMembers
ChatGroupManager.muteMembers
ChatGroupManager.removeAdmin
ChatGroupManager.removeAllowList
ChatGroupManager.removeGroupSharedFile
ChatGroupManager.removeMembers
ChatGroupManager.requestToJoinPublicGroup
ChatGroupManager.unblockGroup
ChatGroupManager.unblockMembers
ChatGroupManager.unMuteAllMembers
ChatGroupManager.unMuteMembers
ChatGroupManager.updateGroupExtension
```

- [x] **Step 2: Rename existing old wrappers to SDK names**

Rename these static methods without keeping old aliases:

```text
acceptGroupInvitation -> acceptInvitation
acceptGroupJoinApplication -> acceptJoinApplication
addGroupAdmin -> addAdmin
addGroupMembers -> addMembers
addGroupWhiteList -> addAllowList
applyJoinToGroup -> requestToJoinPublicGroup
blockGroupMembers -> blockMembers
changeGroupOwner -> changeOwner
checkIfInGroupWhiteList -> isMemberInAllowListFromServer
declineGroupInvitation -> declineInvitation
declineGroupJoinApplication -> declineJoinApplication
deleteGroupMembers -> removeMembers
deleteGroupSharedFile -> removeGroupSharedFile
getGroupAnnouncementFromServer -> fetchAnnouncementFromServer
getGroupBlockListFromServer -> fetchBlockListFromServer
getGroupFileListFromServer -> fetchGroupFileListFromServer
getGroupMemberListFromServer -> fetchMemberListFromServer
getGroupMuteListFromServer -> fetchMuteListFromServer
getGroupWhiteListFromServer -> fetchAllowListFromServer
muteGroupAllMembers -> muteAllMembers
muteGroupMembers -> muteMembers
removeGroupAdmin -> removeAdmin
removeGroupWhiteList -> removeAllowList
unBlockGroup -> unblockGroup
unBlockGroupMembers -> unblockMembers
unMuteGroupAllMembers -> unMuteAllMembers
unMuteGroupMembers -> unMuteMembers
updateGroupExt -> updateGroupExtension
```

For each renamed wrapper, keep the existing SDK call and parameter mapping unless the SDK declaration proves the mapping is wrong.

- [x] **Step 3: Remove deprecated group wrapper**

Remove `static createGroup(...)` because `ChatGroupManager.createGroup` is deprecated. Keep `createGroupEx(...)` because it is active.

- [x] **Step 4: Verify tags and callback style**

For every edited method, ensure the third `tryCatch` argument uses the SDK method `.name`, for example:

```typescript
ChatClient.getInstance().groupManager.addAdmin.name
```

Expected: no string literal tag such as `'addAdmin'` is introduced.

- [x] **Step 5: Verify group audit entries**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

Expected: group methods renamed in Step 2 no longer appear under `missing active wrappers`; `ChatGroupManager.createGroup` no longer appears under `deprecated wrappers present`.

## Task 5: Align BizChatRoomManager

**Files:**
- Modify: `measured_app/src/biz/BizChatRoomManager.ts`
- Reference: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/ChatRoomManager.d.ts`

- [x] **Step 1: List room missing wrappers**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api | sed -n '/missing active wrappers:/,/deprecated wrappers present:/p' | rg 'ChatRoomManager'
```

Expected current missing names include:

```text
ChatRoomManager.addAttributes
ChatRoomManager.addChatRoomAdmin
ChatRoomManager.blockChatRoomMembers
ChatRoomManager.changeChatRoomDescription
ChatRoomManager.changeChatRoomSubject
ChatRoomManager.changeOwner
ChatRoomManager.createChatRoom
ChatRoomManager.destroyChatRoom
ChatRoomManager.fetchChatRoomAnnouncement
ChatRoomManager.fetchChatRoomBlockList
ChatRoomManager.fetchChatRoomMembers
ChatRoomManager.fetchChatRoomMuteList
ChatRoomManager.fetchPublicChatRoomsFromServer
ChatRoomManager.leaveChatRoom
ChatRoomManager.muteChatRoomMembers
ChatRoomManager.removeAttributes
ChatRoomManager.removeChatRoomAdmin
ChatRoomManager.removeChatRoomMembers
ChatRoomManager.unBlockChatRoomMembers
ChatRoomManager.unMuteChatRoomMembers
ChatRoomManager.updateChatRoomAnnouncement
```

- [x] **Step 2: Rename existing old wrappers to SDK names**

Rename these static methods without keeping old aliases:

```text
addRoomAdmin -> addChatRoomAdmin
addRoomAttributes -> addAttributes
blockRoomMembers -> blockChatRoomMembers
changeRoomDescription -> changeChatRoomDescription
changeRoomName -> changeChatRoomSubject
changeRoomOwner -> changeOwner
createRoom -> createChatRoom
deleteRoomMembers -> removeChatRoomMembers
destroyRoom -> destroyChatRoom
fetchPublicRoomsFromServer -> fetchPublicChatRoomsFromServer
fetchRoomAnnouncement -> fetchChatRoomAnnouncement
fetchRoomBlockList -> fetchChatRoomBlockList
fetchRoomMembers -> fetchChatRoomMembers
fetchRoomMuteList -> fetchChatRoomMuteList
leaveRoom -> leaveChatRoom
muteRoomMembers -> muteChatRoomMembers
removeRoomAdmin -> removeChatRoomAdmin
removeRoomAttributes -> removeAttributes
unBlockRoomMembers -> unBlockChatRoomMembers
unMuteRoomMembers -> unMuteChatRoomMembers
updateRoomAnnouncement -> updateChatRoomAnnouncement
```

- [x] **Step 3: Verify room parameter aliases**

Review each renamed wrapper against `ChatRoomManager.d.ts`. Keep existing input field aliases such as `roomId`, `members`, `newDescription`, `newName`, `welcomeMsg`, and `maxUserCount` only when they map to the same SDK parameter positions.

- [x] **Step 4: Verify room audit entries**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

Expected: room methods renamed in Step 2 no longer appear under `missing active wrappers`.

## Task 6: Align BizChatPresenceManager, BizChatPushManager, and BizChatUserInfoManager

**Files:**
- Modify: `measured_app/src/biz/BizChatPresenceManager.ts`
- Modify: `measured_app/src/biz/BizChatPushManager.ts`
- Modify: `measured_app/src/biz/BizChatUserInfoManager.ts`
- Reference: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/ChatPresenceManager.d.ts`
- Reference: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/ChatPushManager.d.ts`
- Reference: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/ChatUserInfoManager.d.ts`

- [x] **Step 1: Rename presence wrappers**

In `BizChatPresenceManager.ts`, rename:

```text
subscribePresences -> subscribe
unsubscribePresences -> unsubscribe
```

Keep existing parameter mapping, and verify tags use:

```typescript
ChatClient.getInstance().presenceManager.subscribe.name
ChatClient.getInstance().presenceManager.unsubscribe.name
```

- [x] **Step 2: Rename push wrappers**

In `BizChatPushManager.ts`, rename:

```text
getPreferredNotificationLanguage -> fetchPreferredNotificationLanguage
getPushConfigFromServer -> fetchPushOptionFromServer
setPushStyle -> updatePushDisplayStyle
updatePushNickName -> updatePushNickname
```

Keep existing parameter mapping. For any missing active push wrapper still reported by audit after renaming, add a thin wrapper directly from `ChatPushManager.d.ts`.

- [x] **Step 3: Rename user info wrappers**

In `BizChatUserInfoManager.ts`, rename:

```text
fetchUserInfoByUserId -> fetchUserInfoById
updateOwnInfo -> updateOwnUserInfo
```

Keep existing user ID list parsing and user info construction if it matches the SDK signatures.

- [x] **Step 4: Verify focused audit entries**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

Expected: presence, push, and user-info renamed methods no longer appear under `missing active wrappers`.

## Task 7: Align BizChatManager

**Files:**
- Modify: `measured_app/src/biz/BizChatManager.ts`
- Reference: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/ChatManager.d.ts`

- [x] **Step 1: List ChatManager missing wrappers**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api | sed -n '/missing active wrappers:/,/deprecated wrappers present:/p' | rg 'ChatManager'
```

Expected current missing names include:

```text
ChatManager.createChatThread
ChatManager.deleteConversationAllMessages
ChatManager.deleteMessagesBeforeTimestamp
ChatManager.deleteMessagesWithTimestamp
ChatManager.destroyChatThread
ChatManager.fetchChatThreadFromServer
ChatManager.fetchChatThreadWithParentFromServer
ChatManager.fetchGroupAcks
ChatManager.fetchJoinedChatThreadFromServer
ChatManager.fetchJoinedChatThreadWithParentFromServer
ChatManager.fetchLastMessageWithChatThread
ChatManager.fetchMembersWithChatThreadFromServer
ChatManager.fetchSupportedLanguages
ChatManager.getAllConversations
ChatManager.getConversationMessageCount
ChatManager.getConversationUnreadCount
ChatManager.getConvMsgsWithKeyword
ChatManager.getLatestMessage
ChatManager.getLatestReceivedMessage
ChatManager.getMessage
ChatManager.getMsgs
ChatManager.getMsgsWithMsgType
ChatManager.getMsgWithTimestamp
ChatManager.getUnreadCount
ChatManager.joinChatThread
ChatManager.leaveChatThread
ChatManager.markAllMessagesAsRead
ChatManager.removeConversationFromServer
ChatManager.removeMemberWithChatThread
ChatManager.removeMessagesWithTimestamp
ChatManager.searchMessages
ChatManager.searchMessagesInConversation
ChatManager.sendGroupMessageReadAck
ChatManager.setConversationExtension
ChatManager.updateChatThreadName
ChatManager.updateConversationMessage
```

- [x] **Step 2: Rename existing old wrappers to SDK names**

Rename these static methods without keeping old aliases:

```text
changeThreadSubject -> updateChatThreadName
createThread -> createChatThread
deleteConversationFromServer -> removeConversationFromServer
destoryThread -> destroyChatThread
fetchGroupReadAcks -> fetchGroupAcks
fetchMineJoinedThreadList -> fetchJoinedChatThreadFromServer
fetchSupportLanguages -> fetchSupportedLanguages
fetchThreadMembers -> fetchMembersWithChatThreadFromServer
getLastMessageAccordingThreads -> fetchLastMessageWithChatThread
getThreadWithThreadId -> fetchChatThreadFromServer
joinThread -> joinChatThread
lastReceivedMessage -> getLatestReceivedMessage
leaveThread -> leaveChatThread
loadAllConversations -> getAllConversations
loadMessage -> getMessage
markAllMessageAsRead -> markAllMessagesAsRead
messagesCount -> getUnreadCount
removeMessagesBeforeTimestamp -> removeMessagesWithTimestamp
removeThreadMember -> removeMemberWithChatThread
setExt -> setConversationExtension
unReadCount -> getConversationUnreadCount
```

For `fetchThreadListOfGroup`, split the existing conditional behavior into SDK-name wrappers if both active methods are missing:

```text
fetchChatThreadWithParentFromServer
fetchJoinedChatThreadWithParentFromServer
```

Each new wrapper should call exactly the matching SDK method. Do not keep the old `fetchThreadListOfGroup` alias.

- [x] **Step 3: Add wrappers without old equivalents**

Read each signature in `ChatManager.d.ts` and add thin wrappers for active methods that remain missing after Step 2, including:

```text
deleteConversationAllMessages
deleteMessagesBeforeTimestamp
deleteMessagesWithTimestamp
getConversationMessageCount
getConvMsgsWithKeyword
getLatestMessage
getMsgs
getMsgsWithMsgType
getMsgWithTimestamp
removeMessagesWithTimestamp
searchMessages
searchMessagesInConversation
sendGroupMessageReadAck
updateConversationMessage
```

Use existing helpers where applicable:

```typescript
this.createConvType(info)
this.createSearchDirection(info.direction)
this.createMessage(info)
```

If an SDK method takes a `ChatMessage`, fetch or construct it in the same style as existing methods such as `downloadAttachment`, `translateMessage`, or `updateMessage`.

- [x] **Step 4: Remove deprecated normal wrapper**

Remove `static fetchConversationsFromServerWithPage(...)` because audit reports it as deprecated. Keep `fetchConversationsFromServerWithCursor(...)` if active and present.

- [x] **Step 5: Verify ChatManager audit entries**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

Expected: ChatManager methods renamed or added in this task no longer appear under `missing active wrappers`; `ChatManager.fetchConversationsFromServerWithPage` no longer appears under `deprecated wrappers present`.

## Task 8: Regenerate Dispatch Routes After Biz Alignment

**Files:**
- Regenerate: `measured_app/src/dispatch/*.generated.ts`
- Regenerate: `measured_app/src/dispatch/index.ts`

- [x] **Step 1: Run generator**

Run:

```bash
cd measured_app
yarn generate:dispatch
```

Expected: generated route counts increase from the baseline because more Biz wrappers now match active SDK method names.

- [x] **Step 2: Inspect route names**

Run:

```bash
rg "case '(addGroupAdmin|createThread|accessToken|getCurrentUserName|getIsConnected)'" measured_app/src/dispatch -n
```

Expected: no output.

Run:

```bash
rg "case '(ChatGroupManager.addAdmin|ChatManager.createChatThread|ChatClient.getAccessToken|ChatClient.getCurrentUsername|ChatClient.isConnected)'" measured_app/src/dispatch -n
```

Expected: output includes generated routes for the manager-qualified SDK-consistent names.

- [x] **Step 3: Inspect generated unknown-command logging**

Run:

```bash
rg "unknown cmd" measured_app/src/dispatch/*.generated.ts -n
```

Expected: every generated file has one line formatted with its SDK manager class name, for example:

```typescript
Logger.raw.warn(`ChatGroupManager: unknown cmd: ${cmd}`);
```

## Task 9: Full Validation and Risk Summary

**Files:**
- Read: `measured_app/src/biz/*.ts`
- Read: `measured_app/src/dispatch/*.generated.ts`
- Read: `measured_app/scripts/generate-dispatch-routes.js`

- [x] **Step 1: Run final audit**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

Expected:

- Command exits 0.
- `missing active wrappers` is empty or contains only explicitly documented deferrals.
- `deprecated wrappers present` is empty except approved protocol exceptions.
- `generated dispatch coverage` reports `routes without active sdk method: 0`.

- [x] **Step 2: Run lint**

Run:

```bash
cd measured_app
yarn lint
```

Expected: exits 0.

- [x] **Step 3: Run tests**

Run:

```bash
cd measured_app
yarn test
```

Expected: exits 0.

- [x] **Step 4: Review risky mappings for final report**

Prepare a short final summary listing edited wrappers that required judgment:

```text
- Group member/list/page wrappers: note pageSize/pageNum/cursor mapping.
- Chat thread wrappers: note old threadId/groupId fields mapped to chatThreadId/parentId.
- Message search wrappers: note direction, timestamp, and count fields.
- Push/user info wrappers: note option/user-info object construction.
- Deprecated removals: loginWithAgoraToken, createGroup, fetchConversationsFromServerWithPage.
```

- [x] **Step 5: Inspect final git diff**

Run:

```bash
git diff --stat
git diff -- measured_app/scripts/generate-dispatch-routes.js measured_app/src/biz measured_app/src/dispatch
```

Expected: diffs are limited to generator, generated dispatch files, and Biz alignment changes, plus the approved spec/plan docs.

## Self-Review

- Spec coverage: The plan covers SDK-name source of truth, no alias compatibility, generator logging, generated file refresh, Biz wrapper alignment, deprecated wrapper removal, and final audit/lint/test validation.
- Placeholder scan: No placeholder markers or vague implementation steps are present.
- Type consistency: Method names in route expectations match SDK names from audit output. `tryCatch` tags are specified as SDK method `.name`, not string literals.
