# JMeter Chat Room Manager Scenarios Design

## Context

`measured_app` exposes `react-native-chat-sdk` APIs through WebSocket commands,
and JMeter drives those commands through `forward_server`. Existing
ChatRoomManager coverage lives in `jmeter/data/rn-sdk-chat-room-manager.jmx`;
it is a wide API coverage plan with many samplers and user-defined variables.

This design applies the closed-loop scenario style already used by
ChatManager, ContactManager, and GroupManager to ChatRoomManager. The generated
plans consume prepared fixture accounts and relationship state, extract runtime
identifiers from SDK responses, use those identifiers in later samplers, and
clean up state created by the scenario when practical.

Chat room fixture preparation is delegated to `jmeter/data-fixtures/`. The
fixture reset creates one chat room through the Easemob REST API and writes its
identifier and related fixture users to
`jmeter/data-fixtures/.state/relationships.env`. Scenario JMX files consume the
resulting fixture room and do not create the baseline room.

## Goal

Add a new set of ChatRoomManager scenario JMeter plans that exercise common
chat room workflows with prepared fixture data and runtime variables.

Each scenario plan should be independently runnable after fixture preparation
and should follow this shape:

1. load fixture `.env` data;
2. initialize Chat SDK;
3. log out to clear stale login state;
4. log in as the prepared chat room owner;
5. verify or mutate the target ChatRoomManager workflow;
6. clean up data created by the scenario when practical;
7. log out.

Scenario files live under:

```text
jmeter/data/chat-room-manager/
```

The existing `jmeter/data/rn-sdk-chat-room-manager.jmx` coverage plan is not
changed by this design.

## Non-Goals

- Do not replace existing API coverage JMeter plans.
- Do not write runtime room IDs, cursors, or attribute keys back into `.jmx`
  files.
- Do not require manual edits to chat-room-related variables after every run.
- Do not design scenario suites for UserInfoManager in this phase.
- Do not cover every ChatRoomManager edge case before the scenario pattern is
  useful.
- Do not create fixture accounts or the baseline fixture room from scenario
  plans. Use `jmeter/data-fixtures/`.
- Do not hide prerequisite failures. If fixture files or the prepared room are
  missing, the scenario should fail fast.
- Do not use setUp Thread Groups or tearDown Thread Groups for init, login, or
  logout. They remain ordinary ordered samplers in each scenario.
- Do not add multi-account ownership-transfer or pending-state scenarios in
  this phase.

## Fixture Usage Contract

Before running ChatRoomManager scenarios, the caller prepares data with:

```bash
cd jmeter/data-fixtures
yarn prepare:accounts
yarn reset:relationships
```

The scenario plans consume these files:

```text
jmeter/data-fixtures/.state/accounts.env
jmeter/data-fixtures/.state/relationships.env
```

Both paths are configurable with JMeter properties:

```text
accountsEnvPath
relationshipsEnvPath
```

Required keys from `accounts.env`:

```text
APP_KEY
DEFAULT_PASSWORD
PRIMARY_USERNAME
PRIMARY_PASSWORD
```

Required keys from `relationships.env`:

```text
APP_KEY
PRIMARY_USERNAME
CONTACT_FIXTURE_READY
ROOM_ID
ROOM_OWNER_USERNAME
ROOM_MEMBER_USERNAME_1
ROOM_MEMBER_USERNAME_2
ROOM_NON_MEMBER_USERNAME_1
ROOM_NON_MEMBER_USERNAME_2
```

The loader verifies that shared keys match across both files. A mismatch means
the relationship state was generated for a different account set and the
scenario must fail with `PRECONDITION_FAILED`.

The loader maps fixture keys to scenario variables:

```text
appKey=${APP_KEY}
username=${ROOM_OWNER_USERNAME}
password=${DEFAULT_PASSWORD}
defaultPassword=${DEFAULT_PASSWORD}
primaryUserId=${PRIMARY_USERNAME}
roomId=${ROOM_ID}
roomOwnerUserId=${ROOM_OWNER_USERNAME}
roomMemberUserId1=${ROOM_MEMBER_USERNAME_1}
roomMemberUserId2=${ROOM_MEMBER_USERNAME_2}
roomNonMemberUserId1=${ROOM_NON_MEMBER_USERNAME_1}
roomNonMemberUserId2=${ROOM_NON_MEMBER_USERNAME_2}
roomMembersCsv=${ROOM_MEMBER_USERNAME_1},${ROOM_MEMBER_USERNAME_2}
```

ChatRoomManager scenarios log in as `ROOM_OWNER_USERNAME` by default because
metadata, moderation, admin, attribute cleanup, and destroy operations require
owner permissions. CLI runs may override `username` and `password` through
JMeter properties for debugging.

The fixture reset guarantees this baseline:

```text
ROOM_OWNER_USERNAME owns ROOM_ID.
ROOM_MEMBER_USERNAME_1 and ROOM_MEMBER_USERNAME_2 are members of ROOM_ID.
ROOM_NON_MEMBER_USERNAME_1 and ROOM_NON_MEMBER_USERNAME_2 are fixture users
  that are not members of ROOM_ID.
CONTACT_FIXTURE_READY=true marks the whole relationship reset as valid.
```

Scenarios that mutate fixture room state remain independently runnable, but the
supported way to restore the baseline is to run `yarn reset:relationships`
again.

## Runtime Variables

Generated `.jmx` files keep stable placeholders and update runtime values
during execution. Runtime variables are not saved back to generated JMX files.

Examples:

```text
roomId
roomOwnerUserId
roomMemberUserId1
roomMemberUserId2
roomNonMemberUserId1
roomNonMemberUserId2
createdRoomId
cursor
pageNum
pageSize
roomName
roomDesc
roomExt
roomAnnouncement
roomWelcome
roomReason
roomAttributeKey
roomAttributeValue
```

Request payload field names stay aligned with the measured app WebSocket
protocol. For example, APIs that read `info.members` continue to send
`members`, and APIs that read `info.roomId` continue to send `roomId`.

## Precondition Failures

Fixture load and response extraction failures use `PRECONDITION_FAILED`, mark
the sampler failed, and stop the current JMeter thread. This prevents later
samplers from calling SDK APIs with empty room IDs, member IDs, or attribute
keys.

The generated Groovy helpers recursively inspect SDK response values for common
field names such as `roomId`, `roomID`, `roomid`, `id`, `owner`, `userId`, and
`username`. They also include map keys while flattening response strings, so
custom attribute names can be asserted after `fetchChatRoomAttributes`.

## Failure Analysis

Scenario failures must be classified before changing tests, assertions,
fixture data, or measured app code. Use these categories:

- environment or account state, such as missing fixture files, stale
  relationships, expired login state, or missing chat room capability;
- test setup or JMeter scenario defect, such as extracting the wrong response
  field or using a variable before it is set;
- fixture setup defect, such as `reset:relationships` not creating the fixture
  room or not writing room keys;
- measured app wrapper defect, such as using the wrong `info` field name,
  calling the wrong SDK method, or mishandling callback responses;
- expected SDK or service business behavior, such as a permission failure for
  a non-owner, duplicate membership, or a missing attribute after cleanup;
- suspected SDK bug, where the request is valid, the environment is ready, and
  observed SDK behavior contradicts the SDK contract or stable prior behavior.

For significant failures or failures that require changing scenario semantics,
fixture topology, wrapper behavior, or assertions, pause and confirm the
classification and fix direction before proceeding.

## Generated JMX Maintenance

ChatRoomManager scenario `.jmx` files are generated artifacts. Direct edits to
`jmeter/data/chat-room-manager/*.jmx` are not the maintenance path because
regeneration will overwrite them.

The generator owns XML escaping, sampler creation, assertions, shared Groovy
helpers, fixture `.env` loading, and scenario definitions:

```text
jmeter/tools/chat_room_manager_scenarios/
```

## Shared Scenario Prologue

Unless a scenario says otherwise, every scenario begins with these ordered
samplers:

1. `Load fixture env`
   - Read and validate `accounts.env` and `relationships.env`.
   - Set `appKey`, `username`, `password`, `primaryUserId`, and room fixture
     variables.
2. `ChatClient.init`
   - Open the WebSocket connection.
   - Expect the wrapper response to contain `"ok":true`.
3. `ChatClient.logout`
   - Clear login state left by a previous failed scenario.
4. `ChatClient.login`
   - Log in as the chat room owner by default.
   - Expect `"ok":true`.

Every scenario ends with a normal ordered `ChatClient.logout` sampler.

## Scenario Categories

The first ChatRoomManager suite contains six scenario plans.

### 1. Chat Room Info Query

File:

```text
jmeter/data/chat-room-manager/chat-room-info-query.jmx
```

Purpose:

Verify fixture room discovery and read APIs without mutating room state.

Core flow:

1. call `ChatRoomManager.getChatRoomWithId` for the fixture room;
2. call `ChatRoomManager.fetchChatRoomInfoFromServer` and assert the fixture
   `roomId` appears;
3. call `ChatRoomManager.fetchChatRoomMembers` and assert the two prepared
   room members appear while a prepared non-member does not;
4. call `ChatRoomManager.fetchPublicChatRoomsFromServer`.

### 2. Chat Room Member Presence

File:

```text
jmeter/data/chat-room-manager/chat-room-member-presence.jmx
```

Purpose:

Verify a prepared non-member can join and leave the fixture room without
permanently changing the baseline.

Core flow:

1. log out the owner and log in as `ROOM_NON_MEMBER_USERNAME_1`;
2. call `ChatRoomManager.joinChatRoomEx`;
3. fetch members and assert the non-member appears;
4. call `ChatRoomManager.leaveChatRoom`;
5. log out the non-member and log back in as the owner;
6. fetch members and assert the non-member no longer appears.

### 3. Chat Room Metadata Lifecycle

File:

```text
jmeter/data/chat-room-manager/chat-room-metadata-lifecycle.jmx
```

Purpose:

Verify owner-managed room subject, description, and announcement APIs.

Core flow:

1. call `ChatRoomManager.changeChatRoomSubject` with a run-unique value;
2. call `ChatRoomManager.changeChatRoomDescription` with a run-unique value;
3. call `ChatRoomManager.updateChatRoomAnnouncement`;
4. call `ChatRoomManager.fetchChatRoomAnnouncement` and assert the runtime
   announcement;
5. call `ChatRoomManager.fetchChatRoomInfoFromServer` and assert the room ID,
   subject, and description are discoverable.

### 4. Chat Room Moderation Lifecycle

File:

```text
jmeter/data/chat-room-manager/chat-room-moderation-lifecycle.jmx
```

Purpose:

Verify owner moderation operations and restore modified member state.

Core flow:

1. add and remove `ROOM_MEMBER_USERNAME_2` as chat room admin;
2. mute `ROOM_MEMBER_USERNAME_1`, fetch the mute list, then unmute it;
3. block `ROOM_NON_MEMBER_USERNAME_1`, fetch the block list, then unblock it;
4. add `ROOM_MEMBER_USERNAME_2` to the allow list, fetch the allow list, then
   remove it.

### 5. Chat Room Create Destroy Lifecycle

File:

```text
jmeter/data/chat-room-manager/chat-room-create-destroy-lifecycle.jmx
```

Purpose:

Verify runtime room creation and cleanup without touching the baseline fixture
room.

Core flow:

1. call `ChatRoomManager.createChatRoom` with a run-unique name and prepared
   member;
2. extract `createdRoomId` from the SDK response;
3. call `ChatRoomManager.fetchChatRoomInfoFromServer` for the new room;
4. call `ChatRoomManager.destroyChatRoom` for `createdRoomId`.

### 6. Chat Room Attributes Lifecycle

File:

```text
jmeter/data/chat-room-manager/chat-room-attributes-lifecycle.jmx
```

Purpose:

Verify custom chat room attributes can be added, fetched, and removed.

Core flow:

1. call `ChatRoomManager.addAttributes` with a run-unique key/value;
2. call `ChatRoomManager.fetchChatRoomAttributes` and assert both the runtime
   key and value appear;
3. call `ChatRoomManager.removeAttributes`;
4. call `ChatRoomManager.fetchChatRoomAttributes` again and assert the runtime
   value no longer appears.

## Test Strategy

Generator tests under `jmeter/tools/chat_room_manager_scenarios/` verify:

- exactly the six approved scenario filenames are generated;
- shared JMeter structure, lifecycle samplers, fixture loading, and
  `PRECONDITION_FAILED` handling are present;
- fixture keys are validated and mapped to documented runtime variables;
- owner login is the default;
- each scenario contains the expected ChatRoomManager commands in the expected
  order;
- generated XML has balanced `hashTree` markers and no obvious
  `undefined|null</stringProp>` output.

Regression checks should include:

```bash
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
node --test jmeter/tools/group_manager_scenarios/generate.test.js
node --test jmeter/tools/contact_manager_scenarios/generate.test.js
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
node --test jmeter/data-fixtures/test/*.test.js
```
