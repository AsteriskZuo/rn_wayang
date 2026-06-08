# measured_app Chat SDK 1.15.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `measured_app`'s remote command surface in line with `react-native-chat-sdk@1.15.0` and add disabled-by-default raw/protocol logging for later JMeter integration.

**Architecture:** Preserve the existing WebSocket puppet architecture: `RNWS` receives and sends messages, `Dispatch` routes `{cmd, info}`, and `Biz*` classes wrap SDK calls. Add a small console-compatible logger with separate raw and JSON channels, and place protocol logging at interception points rather than inside every API wrapper.

**Tech Stack:** React Native 0.83.2, React 19.2.0, TypeScript, Jest, ESLint, Yarn 4.14.1, `react-native-chat-sdk@1.15.0`.

---

## File Structure

- Modify: `measured_app/src/Dispatch.ts`
  Route new or changed remote commands to the correct Biz wrapper.

- Modify: `measured_app/src/RNWS.ts`
  Replace raw `console.log` transport logs with `Logger.raw.*`, and add decoded protocol send/receive logging with `Logger.json.*`.

- Modify: `measured_app/src/App.tsx`
  Add raw and JSON logging toggles. Keep START/STOP behavior intact.

- Modify: `measured_app/src/biz/BizBase.ts`
  Add centralized success/failure logging around SDK promise results.

- Modify: `measured_app/src/biz/BizChatClient.ts`
  Add missing 1.15.0 client wrappers such as token login, login-state, app key/app id changes, log compression, device management, push config, and RTC token helpers.

- Modify: `measured_app/src/biz/BizChatManager.ts`
  Add selected missing 1.15.0 message/conversation wrappers, especially replacement APIs and server-side conversation/message operations.

- Modify: `measured_app/src/biz/BizChatGroupManager.ts`
  Add selected missing 1.15.0 group wrappers such as `createGroupEx`, avatar update, member attributes, member info list, invite user, and joined group count.

- Modify: `measured_app/src/biz/BizChatRoomManager.ts`
  Add selected missing 1.15.0 room wrappers such as `joinChatRoomEx`, room info lookup, allow-list APIs, all-member mute APIs, and room attribute APIs.

- Modify: `measured_app/src/biz/BizChatContactManager.ts`
  Add selected missing 1.15.0 contact wrappers such as DB block list, all contacts, single contact, paged contacts, and contact remark.

- Modify: `measured_app/src/biz/BizChatPresenceManager.ts`
  Align `unsubscribePresences` with SDK spelling `unsubscribe`.

- Modify: `measured_app/src/biz/BizChatPushManager.ts`
  Replace current push stub wrappers with SDK 1.15.0 calls and add missing silent-mode/template APIs.

- Modify: `measured_app/src/biz/BizChatUserInfoManager.ts`
  Add `fetchOwnInfo`.

- Create: `measured_app/src/Logger.ts`
  Provide console-compatible `Logger.raw` and `Logger.json` APIs, independent enable switches, and JSON normalization.

---

### Task 1: Establish Baseline and API Gap Inventory

**Files:**
- Read: `measured_app/package.json`
- Read: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/*.d.ts`
- Read: `measured_app/src/Dispatch.ts`
- Read: `measured_app/src/biz/*.ts`

- [ ] **Step 1: Confirm installed SDK version**

Run:

```bash
cd measured_app
yarn why react-native-chat-sdk
```

Expected: output includes `react-native-chat-sdk@npm:1.15.0`.

- [ ] **Step 2: Run current static baseline**

Run:

```bash
cd measured_app
yarn lint
yarn test
```

Expected: record PASS/FAIL before implementation. If baseline fails, capture exact failures and keep later changes focused on errors introduced by this task.

- [ ] **Step 3: Generate SDK public Promise method inventory**

Run:

```bash
node -e "const fs=require('fs');const files=['ChatClient','ChatManager','ChatGroupManager','ChatRoomManager','ChatContactManager','ChatPresenceManager','ChatPushManager','ChatUserInfoManager'];for(const f of files){const p='measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/'+f+'.d.ts';const s=fs.readFileSync(p,'utf8');const ms=[...s.matchAll(/^    ([a-zA-Z][a-zA-Z0-9_]*)\\([^;]*\\): Promise<[^;]+>;/gm)].map(m=>m[1]);console.log('\\n'+f);console.log([...new Set(ms)].join('\\n'));}"
```

Expected: method lists for all eight SDK managers.

- [ ] **Step 4: Generate current wrapper inventory**

Run:

```bash
rg -n "^  static |case '" measured_app/src/Dispatch.ts measured_app/src/biz
```

Expected: current `Dispatch` commands and Biz static wrapper methods.

- [ ] **Step 5: Decide method buckets for implementation**

Use the inventories to place SDK methods into these buckets:

```text
keep-existing: current command already maps to a working SDK call
adjust-existing: current command exists but SDK spelling/signature changed
add-incremental: 1.15.0 public method is missing and maps cleanly to current Biz pattern
defer-native-or-jmeter: requires file/device/JMeter payload design beyond compile validation
```

Expected: every implemented method in later tasks comes from `adjust-existing` or `add-incremental`.

---

### Task 2: Update Client, Contact, Presence, User Info, and Push Wrappers

**Files:**
- Modify: `measured_app/src/biz/BizChatClient.ts`
- Modify: `measured_app/src/biz/BizChatContactManager.ts`
- Modify: `measured_app/src/biz/BizChatPresenceManager.ts`
- Modify: `measured_app/src/biz/BizChatPushManager.ts`
- Modify: `measured_app/src/biz/BizChatUserInfoManager.ts`
- Modify: `measured_app/src/Dispatch.ts`

- [ ] **Step 1: Add client wrappers using the existing `tryCatch` pattern**

Use this exact style for client methods:

```ts
static loginWithToken(info: any, callback: ReturnCallback) {
  const userName = info.username;
  const token = info.token;
  this.tryCatch(
    ChatClient.getInstance().loginWithToken(userName, token),
    callback,
    ChatClient.getInstance().loginWithToken.name,
  );
}
```

Add wrappers for SDK 1.15.0 client methods that are missing and do not require native setup:

```text
isLoginBefore
loginWithToken
changeAppKey
changeAppId
compressLogs
getLoggedInDevicesFromServer
kickDevice
kickAllDevices
updatePushConfig
getRTCTokenInfoWithChannelName
getUserIdsWithRTCUids
```

Parameter mapping:

```text
changeAppKey: info.appKey
changeAppId: info.appId
getLoggedInDevicesFromServer: info.username, info.password
kickDevice: info.username, info.password, info.resource
kickAllDevices: info.username, info.password
updatePushConfig: info.deviceId, info.deviceToken
getRTCTokenInfoWithChannelName: info.channelName
getUserIdsWithRTCUids: info.channelName, info.uids split by comma
```

- [ ] **Step 2: Add contact wrappers**

Add wrappers for:

```text
getBlockListFromDB
getAllContacts
getContact
fetchAllContacts
setContactRemark
```

Parameter mapping:

```text
getContact: info.username
fetchAllContacts: info.cursor, info.pageSize
setContactRemark: info.username, info.remark
```

- [ ] **Step 3: Align presence spelling**

In `BizChatPresenceManager.unsubscribePresences`, call SDK method `unsubscribe(members)` instead of the old spelling if the current source uses `unSubscribe`.

Expected wrapper body:

```ts
static unsubscribePresences(info: any, callback: ReturnCallback) {
  const members = (info.members as string).split(',');
  this.tryCatch(
    ChatClient.getInstance().presenceManager.unsubscribe(members),
    callback,
    ChatClient.getInstance().presenceManager.unsubscribe.name,
  );
}
```

- [ ] **Step 4: Replace push stubs with real SDK calls**

Implement existing stub commands where SDK 1.15.0 has direct APIs:

```text
getPushConfigFromServer -> fetchPushOptionFromServer()
updatePushNickName -> updatePushNickname(info.nickname ?? info.nickName)
setPushStyle -> updatePushDisplayStyle(displayStyle)
```

Add wrappers for:

```text
fetchSilentModeForAll
removeSilentModeForConversation
fetchSilentModeForConversation
fetchSilentModeForConversations
selectPushTemplate
fetchSelectedPushTemplate
```

For `setPushStyle`, map `info.displayStyle === 'summary'` to `ChatPushDisplayStyle.Summary`; otherwise use `ChatPushDisplayStyle.Simple`.

- [ ] **Step 5: Add user info wrapper**

Add:

```ts
static fetchOwnInfo(info: any, callback: ReturnCallback) {
  this.tryCatch(
    ChatClient.getInstance().userManager.fetchOwnInfo(),
    callback,
    ChatClient.getInstance().userManager.fetchOwnInfo.name,
  );
}
```

- [ ] **Step 6: Wire commands in `Dispatch.ts`**

Add `case` entries that call the new static methods. Use command names matching method names unless an existing command already names the feature.

Example:

```ts
case 'loginWithToken': {
  BizChatClient.loginWithToken(info, callback);
  break;
}
```

- [ ] **Step 7: Validate this task**

Run:

```bash
cd measured_app
yarn lint
yarn test
```

Expected: no TypeScript/ESLint errors from the modified wrappers or dispatch cases.

---

### Task 3: Update Group and Room Wrappers

**Files:**
- Modify: `measured_app/src/biz/BizChatGroupManager.ts`
- Modify: `measured_app/src/biz/BizChatRoomManager.ts`
- Modify: `measured_app/src/Dispatch.ts`

- [ ] **Step 1: Add group wrappers**

Add wrappers for SDK 1.15.0 group APIs that map cleanly:

```text
createGroupEx
fetchGroupInfoWithoutMembersFromServer
fetchMemberInfoListFromServer
inviteUser
updateGroupAvatar
setMemberAttribute
fetchMemberAttributes
fetchMembersAttributes
fetchJoinedGroupCount
```

Parameter mapping:

```text
createGroupEx:
  info.style, info.maxCount, info.inviteNeedConfirm, info.ext,
  info.groupName, info.groupAvatar, info.desc,
  info.members split by comma, info.inviteReason

fetchGroupInfoWithoutMembersFromServer:
  info.groupId

fetchMemberInfoListFromServer:
  info.groupId, info.cursor, info.limit ?? info.pageSize

inviteUser:
  info.groupId, info.members split by comma, info.reason

updateGroupAvatar:
  info.groupId, info.avatar

setMemberAttribute:
  info.groupId, info.username ?? info.member, attributes from info.attributes or info.attribute

fetchMemberAttributes:
  info.groupId, info.username ?? info.member

fetchMembersAttributes:
  info.groupId, info.members split by comma, info.attributeKeys split by comma when provided

fetchJoinedGroupCount:
  no required info fields
```

- [ ] **Step 2: Add room wrappers**

Add wrappers for SDK 1.15.0 room APIs that map cleanly:

```text
joinChatRoomEx
fetchChatRoomInfoFromServer
getChatRoomWithId
fetchChatRoomAllowListFromServer
isMemberInChatRoomAllowList
isMemberInChatRoomMuteList
addMembersToChatRoomAllowList
removeMembersFromChatRoomAllowList
muteAllChatRoomMembers
unMuteAllChatRoomMembers
fetchChatRoomAttributes
addRoomAttributes
removeRoomAttributes
```

Parameter mapping:

```text
joinChatRoomEx:
  {roomId: info.roomId, exitOtherRoom: info.exitOtherRoom, ext: info.ext}

fetchChatRoomInfoFromServer:
  info.roomId

getChatRoomWithId:
  info.roomId

allow-list and mute-list checks:
  info.roomId

add/remove allow-list:
  info.roomId, info.members split by comma

fetchChatRoomAttributes:
  info.roomId, info.keys split by comma when provided

addRoomAttributes:
  roomId: info.roomId
  attributes: info.attributes
  deleteWhenLeft: info.deleteWhenLeft
  overwrite: info.overwrite

removeRoomAttributes:
  roomId: info.roomId
  keys: info.keys split by comma
  forced: info.forced
```

- [ ] **Step 3: Wire group and room commands in `Dispatch.ts`**

Add `case` entries using method names for new commands:

```ts
case 'fetchJoinedGroupCount': {
  BizChatGroupManager.fetchJoinedGroupCount(info, callback);
  break;
}
case 'joinChatRoomEx': {
  BizChatRoomManager.joinChatRoomEx(info, callback);
  break;
}
```

- [ ] **Step 4: Validate this task**

Run:

```bash
cd measured_app
yarn lint
yarn test
```

Expected: no TypeScript/ESLint errors from group or room changes.

---

### Task 4: Update Message and Conversation Wrappers

**Files:**
- Modify: `measured_app/src/biz/BizChatManager.ts`
- Modify: `measured_app/src/Dispatch.ts`

- [ ] **Step 1: Add helper parsing only if it reduces repeated field extraction**

If `BizChatManager.ts` needs repeated conversion for conversation type and message IDs, keep helper methods private/static and local to `BizChatManager`.

Use the existing `createConvType(info)` helper for conversation type. For comma-separated arrays, use this local pattern:

```ts
const msgIds = (info.msgIds as string).split(',');
```

- [ ] **Step 2: Add replacement and missing message wrappers**

Add wrappers for these SDK 1.15.0 APIs:

```text
sendConversationReadAck
getMessagesWithIds
downloadAttachmentInCombine
downloadThumbnailInCombine
fetchHistoryMessagesByOptions
getMsgsWithKeyword
getConvsMsgsWithKeyword
fetchReactionList
fetchReactionDetail
groupAckCount
getMessageThread
getThreadConversation
fetchConversationsFromServerWithPage
fetchConversationsFromServerWithCursor
fetchPinnedConversationsFromServerWithCursor
pinConversation
removeMessagesFromServerWithMsgIds
removeMessagesFromServerWithTimestamp
fetchConversationsByOptions
deleteAllMessageAndConversation
pinMessage
unpinMessage
fetchPinnedMessages
getPinnedMessages
getMessagePinInfo
getMessageCount
```

Parameter mapping:

```text
sendConversationReadAck:
  info.convId

getMessagesWithIds:
  info.convId, createConvType(info), info.msgIds split by comma

downloadAttachmentInCombine / downloadThumbnailInCombine:
  load message by info.messageId, callback null if not found

fetchHistoryMessagesByOptions:
  info.convId, createConvType(info), params with info.cursor, info.pageSize, and optional options fields from info.options

getMsgsWithKeyword:
  info.keywords, info.timestamp, info.maxCount, info.from, direction from info.direction, searchScope from info.searchScope

getConvsMsgsWithKeyword:
  same keyword fields as getMsgsWithKeyword

fetchReactionList:
  info.msgIds split by comma, info.groupId, info.chatType

fetchReactionDetail:
  info.msgId ?? info.messageId, info.reaction, info.cursor, info.pageSize

groupAckCount:
  info.messageId

getMessageThread:
  info.messageId

getThreadConversation:
  info.threadId

fetchConversationsFromServerWithPage:
  info.pageNum, info.pageSize

fetchConversationsFromServerWithCursor:
  info.cursor, info.pageSize

fetchPinnedConversationsFromServerWithCursor:
  info.cursor, info.pageSize

pinConversation:
  info.convId, info.isPinned

removeMessagesFromServerWithMsgIds:
  info.convId, createConvType(info), info.msgIds split by comma

removeMessagesFromServerWithTimestamp:
  info.convId, createConvType(info), info.timestamp

fetchConversationsByOptions:
  info.options

deleteAllMessageAndConversation:
  info.clearServerData

pinMessage / unpinMessage:
  info.messageId

fetchPinnedMessages:
  info.convId, createConvType(info), info.cursor, info.pageSize

getPinnedMessages:
  info.convId, createConvType(info)

getMessagePinInfo:
  info.messageId

getMessageCount:
  no required info fields
```

- [ ] **Step 3: Fix existing reaction detail mapping**

If `getReactionDetail` still calls `getReactionList`, change it to the SDK 1.15.0 detail API:

```text
fetchReactionDetail(msgId, reaction, cursor, pageSize)
```

- [ ] **Step 4: Wire message commands in `Dispatch.ts`**

Add cases for new wrappers. Preserve existing command names. Add new command names only for newly exposed APIs.

Example:

```ts
case 'fetchReactionDetail': {
  BizChatManager.fetchReactionDetail(info, callback);
  break;
}
```

- [ ] **Step 5: Validate this task**

Run:

```bash
cd measured_app
yarn lint
yarn test
```

Expected: no TypeScript/ESLint errors from message manager changes.

---

### Task 5: Add Logger Module and Centralized Logging

**Files:**
- Create: `measured_app/src/Logger.ts`
- Modify: `measured_app/src/RNWS.ts`
- Modify: `measured_app/src/Dispatch.ts`
- Modify: `measured_app/src/biz/BizBase.ts`
- Modify: `measured_app/src/App.tsx`

- [ ] **Step 1: Create console-compatible logger**

Create `measured_app/src/Logger.ts` with this API shape:

```ts
type LogFunction = (...args: any[]) => void;

class LogChannel {
  private enabled = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  log: LogFunction = (...args: any[]) => {
    if (this.enabled) {
      console.log(...args);
    }
  };

  warn: LogFunction = (...args: any[]) => {
    if (this.enabled) {
      console.warn(...args);
    }
  };

  error: LogFunction = (...args: any[]) => {
    if (this.enabled) {
      console.error(...args);
    }
  };
}

class JsonLogChannel extends LogChannel {
  normalize(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch (_error) {
      return value;
    }
  }

  log: LogFunction = (...args: any[]) => {
    if (this.isEnabled()) {
      console.log(...args.map(arg => this.normalize(arg)));
    }
  };

  warn: LogFunction = (...args: any[]) => {
    if (this.isEnabled()) {
      console.warn(...args.map(arg => this.normalize(arg)));
    }
  };

  error: LogFunction = (...args: any[]) => {
    if (this.isEnabled()) {
      console.error(...args.map(arg => this.normalize(arg)));
    }
  };
}

export class Logger {
  static raw = new LogChannel();
  static json = new JsonLogChannel();
}
```

- [ ] **Step 2: Replace RNWS raw logs and add decoded JSON logs**

In `RNWS.ts`, import `Logger` and replace raw logs:

```ts
Logger.raw.log(`${RNWS.TAG}: onopen:`);
Logger.raw.log(`${RNWS.TAG}: onmessage:`, e.data);
Logger.raw.error(`${RNWS.TAG}: onerror:`, e.message);
Logger.raw.log(`${RNWS.TAG}: onclose: `, e.code, e.reason);
Logger.raw.log(`${RNWS.TAG}: stop:`);
Logger.raw.log(`${RNWS.TAG}: send:`, data);
```

Add protocol logs:

```ts
Logger.json.log(`${RNWS.TAG}: recv:`, e.data);
Logger.json.log(`${RNWS.TAG}: send:`, data);
```

- [ ] **Step 3: Add Dispatch protocol logs**

In `Dispatch.ts`, replace parse warning and dispatch log with JSON channel calls:

```ts
Logger.json.warn(`${Dispatch.TAG}: dispatch parse failed:`, data, error);
Logger.json.log(`${Dispatch.TAG}: dispatch:`, cmd, info);
```

- [ ] **Step 4: Add centralized SDK result logging**

In `BizBase.tryCatch`, log method success and failure:

```ts
Logger.json.log(`${tag}: success:`, value);
Logger.json.error(`${tag}: error:`, error);
```

Keep callback behavior unchanged.

- [ ] **Step 5: Add UI toggles**

In `App.tsx`, add two boolean state values:

```ts
const [rawLogEnabled, setRawLogEnabled] = React.useState(false);
const [jsonLogEnabled, setJsonLogEnabled] = React.useState(false);
```

Add two press handlers:

```ts
const toggleRawLog = () => {
  const next = !rawLogEnabled;
  Logger.raw.setEnabled(next);
  setRawLogEnabled(next);
};

const toggleJsonLog = () => {
  const next = !jsonLogEnabled;
  Logger.json.setEnabled(next);
  setJsonLogEnabled(next);
};
```

Add two buttons below START/STOP:

```tsx
<View style={styles.buttonCon}>
  <Text style={styles.btn2} onPress={toggleRawLog}>
    {rawLogEnabled ? 'RAW LOG ON' : 'RAW LOG OFF'}
  </Text>
</View>
<View style={styles.buttonCon}>
  <Text style={styles.btn2} onPress={toggleJsonLog}>
    {jsonLogEnabled ? 'JSON LOG ON' : 'JSON LOG OFF'}
  </Text>
</View>
```

- [ ] **Step 6: Validate this task**

Run:

```bash
cd measured_app
yarn lint
yarn test
```

Expected: no TypeScript/ESLint/Jest failures from logger changes.

---

### Task 6: Final Verification and Review

**Files:**
- Review: `measured_app/src/Dispatch.ts`
- Review: `measured_app/src/RNWS.ts`
- Review: `measured_app/src/Logger.ts`
- Review: `measured_app/src/biz/*.ts`

- [ ] **Step 1: Check for duplicate Dispatch cases**

Run:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('measured_app/src/Dispatch.ts','utf8');const cases=[...s.matchAll(/case '([^']+)'/g)].map(m=>m[1]);const dup=cases.filter((v,i)=>cases.indexOf(v)!==i);console.log([...new Set(dup)].join('\\n')||'no duplicates');"
```

Expected: `no duplicates`.

- [ ] **Step 2: Check for direct console logs left in modified central files**

Run:

```bash
rg -n "console\\." measured_app/src/RNWS.ts measured_app/src/Dispatch.ts measured_app/src/biz/BizBase.ts
```

Expected: no matches except inside `measured_app/src/Logger.ts`, which is intentionally excluded from this command.

- [ ] **Step 3: Run final validation**

Run:

```bash
cd measured_app
yarn lint
yarn test
```

Expected: both commands pass.

- [ ] **Step 4: Summarize deferred work**

Record in the final response:

```text
JMeter plans were not updated.
Native Android/iOS runtime validation was not performed.
Integration validation should use Logger.json during the later JMeter task.
```
