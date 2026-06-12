# JMeter API Coverage

## Scope

This document tracks positive JMeter coverage for the measured app generated Chat SDK routes.

Coverage means the JMeter sampler sends a valid command through `forward_server`, `measured_app` dispatches it to the matching Biz wrapper, and the response body contains `"ok":true`.

Negative cases are not covered in this pass.

## Manager Plans

| Manager | JMX File | Status |
| --- | --- | --- |
| Base template | `jmeter/data/rn-sdk-base.jmx` | Normalized reference flow |
| ChatClient | `jmeter/data/rn-sdk-chat-client.jmx` | Positive coverage |
| ChatManager | `jmeter/data/rn-sdk-chat-manager.jmx` | Positive coverage |
| ChatGroupManager | `jmeter/data/rn-sdk-group-manager.jmx` | Positive coverage |
| ChatRoomManager | `jmeter/data/rn-sdk-chat-room-manager.jmx` | Positive coverage |
| ChatContactManager | `jmeter/data/rn-sdk-contact-manager.jmx` | Positive coverage |
| ChatPresenceManager | `jmeter/data/rn-sdk-presence-manager.jmx` | Positive coverage |
| ChatPushManager | `jmeter/data/rn-sdk-push-manager.jmx` | Positive coverage |
| ChatUserInfoManager | `jmeter/data/rn-sdk-user-info-manager.jmx` | Positive coverage |

## Variable Rules

Every business input used by a sampler is declared in that JMX file's User Defined Variables section.

If future manual maintenance adds a sampler and forgets to declare a variable, that is a future test-maintenance issue. This pass does not add runtime guards for missing variables.

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
