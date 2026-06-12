# JMeter API Coverage

## Scope

This document tracks positive JMeter coverage for the measured app generated Chat SDK routes.

Coverage means the JMeter sampler sends a valid command through `forward_server`, `measured_app` dispatches it to the matching Biz wrapper, and the response body contains `"ok":true`.

Negative cases are not covered in this pass.

Coverage status has three meanings:

- **Default runnable positive coverage**: enabled by default and expected to pass when common login and fixture variables are valid.
- **Conditional positive coverage**: sampler exists but is disabled by default or requires explicit tester-provided state, tokens, unique accounts, or environment credentials before running.
- **Limited coverage**: sampler exists, but the current measured app wrapper or SDK flow limits what `"ok":true` proves.

## Manager Plans

| Manager | JMX File | Status |
| --- | --- | --- |
| Base template | `jmeter/data/rn-sdk-base.jmx` | Normalized reference flow |
| ChatClient | `jmeter/data/rn-sdk-chat-client.jmx` | Default and conditional positive coverage |
| ChatManager | `jmeter/data/rn-sdk-chat-manager.jmx` | Default, conditional, and limited positive coverage |
| ChatGroupManager | `jmeter/data/rn-sdk-group-manager.jmx` | Default, conditional, and limited positive coverage |
| ChatRoomManager | `jmeter/data/rn-sdk-chat-room-manager.jmx` | Default and conditional positive coverage |
| ChatContactManager | `jmeter/data/rn-sdk-contact-manager.jmx` | Default and limited positive coverage |
| ChatPresenceManager | `jmeter/data/rn-sdk-presence-manager.jmx` | Default positive coverage |
| ChatPushManager | `jmeter/data/rn-sdk-push-manager.jmx` | Default and conditional positive coverage |
| ChatUserInfoManager | `jmeter/data/rn-sdk-user-info-manager.jmx` | Default positive coverage |

## Variable Rules

Every business input used by a sampler is declared in that JMX file's User Defined Variables section.

If future manual maintenance adds a sampler and forgets to declare a variable, that is a future test-maintenance issue. This pass does not add runtime guards for missing variables.

String variable values used inside request JSON must be JSON-safe. Do not put raw double quotes, backslashes, or newlines into JMeter variables unless the value is already correctly escaped for JSON. Variables intended to represent JSON objects must be inserted as raw JSON objects, not quoted strings.

## Common Variables

| Variable | Meaning |
| --- | --- |
| `url` | WebSocket relay host |
| `port` | WebSocket relay port |
| `topic` | Relay topic used by JMeter and measured_app |
| `username` | Primary login user |
| `password` | Primary login password |
| `contactUserId` | Peer user for contact and peer-message APIs |
| `groupId` | Existing group for group APIs |
| `roomId` | Existing chat room for room APIs |
| `conversationId` | Existing conversation ID |
| `messageId` | Existing message ID |
| `threadId` | Existing chat thread ID |
| `localFilePath` | Local file path available to the measured app environment |

## Manager-Specific Variables

### ChatClient

| Variable | Meaning |
| --- | --- |
| `appKey` | App key used by `ChatClient.init` |
| `username` | Primary user for password login and account/device APIs |
| `password` | Primary user password for password login and account/device APIs |
| `newUsername` | Account name used by `ChatClient.createAccount` |
| `newPassword` | Password used by `ChatClient.createAccount` |
| `token` | User token used by `ChatClient.loginWithToken` |
| `agoraToken` | Agora token passed as `token` to `ChatClient.renewAgoraToken` |
| `newAppKey` | App key passed to `ChatClient.changeAppKey` |
| `newAppId` | App ID passed to `ChatClient.changeAppId` |
| `deviceResource` | Device resource passed to `ChatClient.kickDevice` |
| `pushDeviceId` | Device ID for `ChatClient.updatePushConfig` |
| `pushDeviceToken` | Device token for `ChatClient.updatePushConfig` |
| `channelName` | RTC channel name for `ChatClient.getRTCTokenInfoWithChannelName` |
| `rtcUidList` | Comma-separated RTC UIDs passed as `uids` to `ChatClient.getUserIdsWithRTCUids` |

### ChatManager

| Variable | Meaning |
| --- | --- |
| `contactUserId` | Peer user for positive peer-message APIs |
| `conversationId` | Conversation ID used by conversation and message-query APIs |
| `conversationType` / `convType` / `chatType` | Conversation/chat type values passed to wrapper helpers |
| `messageId` / `messageIdsCsv` | Existing message ID or comma-separated message IDs |
| `groupId` | Existing group ID for group ack and chat-thread APIs |
| `threadId` / `threadIdsCsv` | Existing chat thread ID or comma-separated thread IDs |
| `content` | Text message content |
| `localPath`, `displayName`, `thumbnailLocalPath` | File/image/video message fixture paths and names |
| `width`, `height`, `duration` | Media message metadata |
| `latitude`, `longitude` | Location message coordinates |
| `action`, `event`, `customData` | Command/custom message fields |
| `msgType`, `direction`, `searchScope` | Message query/search options |
| `timestamp`, `startTime`, `endTime`, `start`, `end` | Message time range values |
| `count`, `maxCount`, `loadCount`, `pageSize`, `cursor` | Paging and count values |
| `keywords`, `sender`, `sendersCsv`, `from` | Message search filters |
| `reaction`, `tag`, `reason`, `languagesCsv` | Reaction, report, and translation values |
| `mark`, `convIdsCsv`, `isPinned` | Conversation mark and pin values |
| `isDeleteServerMessages`, `clearServerData` | Destructive server cleanup flags |
| `createIfNeed`, `withMessage`, `isChatThread` | Conversation creation and thread flags |
| `bodyJson`, `extJson`, `optionsJson`, `importMessagesJson` | Raw JSON objects/arrays inserted into request JSON |

Most `ChatManager` samplers are conditional and disabled by default because they
depend on existing message IDs, server-side conversation state, reactions,
threads, or destructive cleanup behavior. The default enabled subset focuses on
basic send/query operations that are least likely to invalidate the test
environment.

### ChatGroupManager

| Variable | Meaning |
| --- | --- |
| `groupId` | Existing group ID used by group APIs |
| `groupName`, `groupDesc`, `groupExt`, `groupAvatar`, `groupAvatarUrl` | Group create/update fields |
| `groupStyle`, `groupMaxCount`, `groupInviteNeedConfirm` | `ChatGroupOptions` values for group creation |
| `groupMembersCsv`, `groupMemberId`, `groupAdminId`, `groupNewOwner` | Member/admin/owner fixture users |
| `groupInviteReason`, `groupWelcome`, `groupReason` | Invite, join, and member-management reason text |
| `groupAnnouncement` | Group announcement text |
| `groupFilePath`, `groupFileId`, `groupSavePath` | Shared-file upload/download/remove fixture values |
| `groupCursor`, `pageNum`, `pageSize`, `groupLimit` | Paging and list values |
| `groupAttributes`, `groupAttributeKeysCsv` | Raw JSON member attributes and comma-separated attribute keys |

State-changing `ChatGroupManager` samplers are conditional and disabled by
default. Query samplers remain enabled when they can operate against the
configured `groupId` without mutating group state.

### ChatRoomManager

| Variable | Meaning |
| --- | --- |
| `roomId` | Existing chat room ID used by room APIs |
| `roomName`, `roomDesc`, `roomWelcome`, `roomExt` | Chat room create/update/join fields |
| `roomMembersCsv`, `roomNewOwner`, `roomAdminId` | Member/admin/owner fixture users |
| `roomMaxUserCount` | Maximum member count for room creation |
| `roomAnnouncement` | Chat room announcement text |
| `roomCursor`, `pageNum`, `pageSize` | Paging and list values |
| `roomAttributeKeysCsv`, `roomAttributes` | Attribute keys and raw JSON attributes |
| `roomDeleteWhenLeft`, `roomOverwrite`, `roomForced` | Attribute behavior flags |

State-changing `ChatRoomManager` samplers are conditional and disabled by
default. Query samplers remain enabled when they can operate against the
configured `roomId` without mutating room state.

### ChatContactManager

| Variable | Meaning |
| --- | --- |
| `contactUserId` | User ID used by contact, block-list, invitation, and remark APIs |
| `contactReason` | Reason sent with `ChatContactManager.addContact` |
| `contactRemark` | Remark sent with `ChatContactManager.setContactRemark` |
| `cursor` | Cursor for paged contact fetch APIs |
| `pageSize` | Page size for paged contact fetch APIs |

### ChatUserInfoManager

| Variable | Meaning |
| --- | --- |
| `userIdsCsv` | Comma-separated user IDs for `fetchUserInfoById` |
| `profileNickName` | Nickname for `updateOwnUserInfo` |
| `profileAvatarUrl` | Avatar URL for `updateOwnUserInfo` |
| `profileEmail` | Email value for `updateOwnUserInfo` |
| `profilePhone` | Phone value for `updateOwnUserInfo` |
| `profileGender` | Numeric gender value for `updateOwnUserInfo` |
| `profileSign` | Signature text for `updateOwnUserInfo` |
| `profileBirth` | Birth date text for `updateOwnUserInfo` |
| `profileExt` | Extension text for `updateOwnUserInfo` |

### ChatPresenceManager

| Variable | Meaning |
| --- | --- |
| `presenceMembersCsv` | Comma-separated members for subscribe, unsubscribe, and status fetch APIs |
| `presenceDescription` | Presence description published by `publishPresence` |
| `presenceExpiry` | Subscription expiry seconds for `subscribe` |
| `pageNum` | Page number for `fetchSubscribedMembers` |
| `pageSize` | Page size for `fetchSubscribedMembers` |

### ChatPushManager

| Variable | Meaning |
| --- | --- |
| `pushConversationId` | Conversation ID for single-conversation silent-mode APIs |
| `pushConversationType` | Conversation type passed as `conversationType` |
| `pushParamType` | Silent-mode parameter type |
| `pushRemindType` | Silent-mode remind type |
| `pushDuration` | Silent-mode duration value |
| `pushStartHour` | Silent-mode interval start hour |
| `pushStartMinute` | Silent-mode interval start minute |
| `pushEndHour` | Silent-mode interval end hour |
| `pushEndMinute` | Silent-mode interval end minute |
| `pushConversationIdsCsv` | Comma-separated conversation IDs for multi-conversation silent-mode fetch |
| `preferredLanguageCode` | Language code for preferred notification language |
| `pushNickname` | Push nickname value |
| `pushDisplayStyle` | Push display style value |
| `pushTemplateName` | Push template name |

## Limited Coverage APIs

Detailed follow-up notes for measured app changes are recorded in
`docs/superpowers/records/2026-06-12-jmeter-positive-api-coverage-record.md`.

| API | What Is Covered | What Is Not Verified | Follow-up |
| --- | --- | --- | --- |
| `ChatContactManager.addContact` | The SDK call resolves and returns `"ok":true`. | Target user receipt, acceptance, and final contact relationship. | Revisit after SDK 1.16.0 provides a callback or stronger result API. |
| `ChatGroupManager.uploadGroupSharedFile` | The command reaches the current wrapper and returns `"ok":true`. | The real SDK upload call is currently commented out in measured_app. | Restore measured_app SDK call later and use a longer JMeter file-transfer timeout. |
| `ChatGroupManager.downloadGroupSharedFile` | The command reaches the current wrapper and returns `"ok":true`. | The real SDK download call is currently commented out in measured_app. | Restore measured_app SDK call later and use a longer JMeter file-transfer timeout. |
| `ChatManager.modifyMsgBody` | JMeter passes a JSON object body to the wrapper. | Runtime bridge conversion of every body shape is not proven by static coverage. | Add a measured app body-construction helper later if runtime conversion fails. |
| `ChatManager.sendMessage` | Peer text-message positive call. | Group and room message creation are not covered because the wrapper currently creates PeerChat messages. | Update measured_app `createMessage` to consume chat type from JMeter input. |
| `ChatManager.insertMessage` | Peer text-message positive call. | Group and room message insertion are not covered because the wrapper currently creates PeerChat messages. | Update measured_app `createMessage` to consume chat type from JMeter input. |
| `ChatManager.updateMessage` | Peer text-message positive call. | Full SDK support for updating all message types is not covered by the current wrapper. | Update measured_app wrapper to support all SDK message body types. |
| `ChatClient.createAccount` | JMeter supplies a variable-driven username and password. | The API succeeds only when `newUsername` is available and not already registered. | Test environments should provide a disposable unique account. |
| `ChatClient.loginWithToken` | JMeter supplies a variable-driven user token. | Token issuance and token freshness are external to this plan. | Supply a valid `token` for the configured `username`. |
| `ChatClient.renewAgoraToken` | JMeter passes `agoraToken` through the wrapper's expected `token` field. | Token issuance and expiry timing are external to this plan. | Supply a valid renewal token when running this sampler. |
| `ChatClient.changeAppId` | JMeter covers the generated route and wrapper payload mapping. | Switching app identity can invalidate the current runtime context if `newAppId` is not for the same test environment. | Keep `newAppId` aligned with the app key/environment used for the run. |
| `ChatClient.kickDevice` | JMeter covers the generated route and wrapper payload mapping. | A real device can be kicked only when `deviceResource` names an active login resource. | Populate `deviceResource` from `getLoggedInDevicesFromServer` output when running a destructive device test. |
| `ChatClient.updatePushConfig` | JMeter covers the generated route and wrapper payload mapping. | Real push registration depends on platform push credentials. | Supply valid `pushDeviceId` and `pushDeviceToken` for the target device. |
| `ChatClient.getRTCTokenInfoWithChannelName` | JMeter covers the generated route and wrapper payload mapping. | RTC token availability depends on channel and backend configuration. | Supply a channel name valid for the test app. |
| `ChatClient.getUserIdsWithRTCUids` | JMeter passes `rtcUidList` as CSV to the wrapper's `uids` field. | Mapping results depend on active RTC UID bindings. | Supply numeric RTC UIDs from the target test environment. |

## SDK Upgrade Notes

When upgrading from SDK 1.15.0 to a newer version, keep existing stable API cases unless the SDK deprecates or replaces the API. Add new cases for new generated routes and update limited coverage notes when newer APIs provide stronger business result signals.
