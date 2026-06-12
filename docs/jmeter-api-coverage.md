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

## Limited Coverage APIs

| API | What Is Covered | What Is Not Verified | Follow-up |
| --- | --- | --- | --- |
| `ChatContactManager.addContact` | The SDK call resolves and returns `"ok":true`. | Target user receipt, acceptance, and final contact relationship. | Revisit after SDK 1.16.0 provides a callback or stronger result API. |

## SDK Upgrade Notes

When upgrading from SDK 1.15.0 to a newer version, keep existing stable API cases unless the SDK deprecates or replaces the API. Add new cases for new generated routes and update limited coverage notes when newer APIs provide stronger business result signals.
