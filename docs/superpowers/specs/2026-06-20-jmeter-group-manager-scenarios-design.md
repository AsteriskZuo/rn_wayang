# JMeter Group Manager Scenarios Design

## Context

`measured_app` exposes `react-native-chat-sdk` APIs through WebSocket commands,
and JMeter drives those commands through `forward_server`. Existing
GroupManager coverage lives in `jmeter/data/rn-sdk-group-manager.jmx`; it is a
wide API coverage plan with many samplers and user-defined variables.

This design applies the closed-loop scenario style already used by
ChatManager and ContactManager to GroupManager. The generated plans consume
prepared fixture accounts and relationship state, extract runtime identifiers
from SDK responses, use those identifiers in later samplers, and clean up
state created by the scenario when practical.

Group fixture preparation is delegated to
`jmeter/data-fixtures/`. The fixture reset creates one public group through
the Easemob REST API and writes its identifiers to
`jmeter/data-fixtures/.state/relationships.env`. The REST group creation
request explicitly creates a public no-approval fixture group by sending:

```json
{
  "public": true,
  "membersonly": false,
  "invite_need_confirm": false
}
```

`membersonly:false` makes joining a public group not require approval.
`invite_need_confirm:false` makes invited members join without a confirmation
step. These fields are REST fixture concerns; scenario JMX files consume the
resulting fixture group and do not create the baseline group.

## Goal

Add a new set of GroupManager scenario JMeter plans that exercise common group
workflows with prepared fixture data and runtime variables.

Each scenario plan should be independently runnable after fixture preparation
and should follow this shape:

1. load fixture `.env` data;
2. initialize Chat SDK;
3. log out to clear stale login state;
4. log in as the prepared group owner;
5. verify or mutate the target GroupManager workflow;
6. clean up data created by the scenario when practical;
7. log out.

Scenario files live under:

```text
jmeter/data/group-manager/
```

The existing `jmeter/data/rn-sdk-group-manager.jmx` coverage plan is not
changed by this design.

## Non-Goals

- Do not replace existing API coverage JMeter plans.
- Do not write runtime group IDs, file IDs, or cursors back into `.jmx` files.
- Do not require manual edits to group-related variables after every run.
- Do not design scenario suites for ChatRoomManager or UserInfoManager in this
  phase.
- Do not cover every GroupManager edge case before the scenario pattern is
  useful.
- Do not create fixture accounts or the baseline fixture group from scenario
  plans. Use `jmeter/data-fixtures/`.
- Do not hide prerequisite failures. If fixture files or the prepared group
  are missing, the scenario should fail fast.
- Do not use setUp Thread Groups or tearDown Thread Groups for init, login, or
  logout. They remain ordinary ordered samplers in each scenario.
- Do not add multi-account invitation or join-application pending-state
  scenarios in this phase.

## Fixture Usage Contract

Before running GroupManager scenarios, the caller prepares data with:

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
GROUP_ID
GROUP_OWNER_USERNAME
GROUP_MEMBER_USERNAME_1
GROUP_MEMBER_USERNAME_2
GROUP_NON_MEMBER_USERNAME_1
GROUP_NON_MEMBER_USERNAME_2
```

The loader verifies that shared keys match across both files. A mismatch means
the relationship state was generated for a different account set and the
scenario must fail with `PRECONDITION_FAILED`.

The loader maps fixture keys to scenario variables:

```text
appKey=${APP_KEY}
username=${GROUP_OWNER_USERNAME}
password=${DEFAULT_PASSWORD}
defaultPassword=${DEFAULT_PASSWORD}
primaryUserId=${PRIMARY_USERNAME}
groupId=${GROUP_ID}
groupOwnerUserId=${GROUP_OWNER_USERNAME}
groupMemberUserId1=${GROUP_MEMBER_USERNAME_1}
groupMemberUserId2=${GROUP_MEMBER_USERNAME_2}
groupNonMemberUserId1=${GROUP_NON_MEMBER_USERNAME_1}
groupNonMemberUserId2=${GROUP_NON_MEMBER_USERNAME_2}
membersCsv=${GROUP_MEMBER_USERNAME_1},${GROUP_MEMBER_USERNAME_2}
```

GroupManager scenarios log in as `GROUP_OWNER_USERNAME` by default because
member management, metadata, moderation, shared-file management, and destroy
operations require group-owner permissions. CLI runs may override `username`
and `password` through JMeter properties for debugging.

The fixture reset guarantees this baseline:

```text
GROUP_OWNER_USERNAME owns GROUP_ID.
GROUP_MEMBER_USERNAME_1 and GROUP_MEMBER_USERNAME_2 are members of GROUP_ID.
GROUP_NON_MEMBER_USERNAME_1 and GROUP_NON_MEMBER_USERNAME_2 are fixture users
  that are not members of GROUP_ID.
CONTACT_FIXTURE_READY=true marks the whole relationship reset as valid.
```

Scenarios that mutate fixture group state remain independently runnable, but
the supported way to restore the baseline is to run `yarn reset:relationships`
again.

## Runtime Variables

Generated `.jmx` files keep stable placeholders and update runtime values
during execution. Runtime variables are not saved back to generated JMX files.

Examples:

```text
groupId
groupOwnerUserId
groupMemberUserId1
groupMemberUserId2
groupNonMemberUserId1
groupNonMemberUserId2
createdGroupId
groupFileId
cursor
pageNum
pageSize
groupName
groupDesc
groupExt
groupAnnouncement
groupAvatar
groupWelcome
groupReason
fileTimeout
```

Request payload field names stay aligned with the measured app WebSocket
protocol. For example, APIs that read `info.members` continue to send
`members`, and APIs that read `info.groupId` continue to send `groupId`.

## Precondition Failures

Fixture load and response extraction failures use `PRECONDITION_FAILED`,
mark the sampler failed, and stop the current JMeter thread. This prevents
later samplers from calling SDK APIs with empty group IDs, member IDs, or file
IDs.

The generated Groovy helpers recursively inspect SDK response values for
common field names such as `groupId`, `groupID`, `groupid`, `id`, `fileId`, and
`file_id`. This is intentionally tolerant of SDK response shape differences
while still failing when no usable value exists.

## Failure Analysis

Scenario failures must be classified before changing tests, assertions,
fixture data, or measured app code. Use these categories:

- environment or account state, such as missing fixture files, stale
  relationships, expired login state, or missing group capability;
- test setup or JMeter scenario defect, such as extracting the wrong response
  field or using a variable before it is set;
- fixture setup defect, such as `reset:relationships` not creating a public
  no-approval fixture group or not writing group keys;
- measured app wrapper defect, such as using the wrong `info` field name,
  calling the wrong SDK method, or mishandling callback responses;
- expected SDK or service business behavior, such as a permission failure for
  a non-owner, duplicate membership, or a missing file after cleanup;
- suspected SDK bug, where the request is valid, the environment is ready, and
  observed SDK behavior contradicts the SDK contract or stable prior behavior.

For significant failures or failures that require changing scenario semantics,
fixture topology, wrapper behavior, or assertions, pause and confirm the
classification and fix direction before proceeding.

## Generated JMX Maintenance

GroupManager scenario `.jmx` files are generated artifacts. Direct edits to
`jmeter/data/group-manager/*.jmx` are not the maintenance path because
regeneration will overwrite them.

The generator owns XML escaping, sampler creation, assertions, shared Groovy
helpers, fixture `.env` loading, and scenario definitions:

```text
jmeter/tools/group_manager_scenarios/
```

## Shared Scenario Prologue

Unless a scenario says otherwise, every scenario begins with these ordered
samplers:

1. `Load fixture env`
   - Read and validate `accounts.env` and `relationships.env`.
   - Set `appKey`, `username`, `password`, `primaryUserId`, and group fixture
     variables.
2. `ChatClient.init`
   - Open the WebSocket connection.
   - Expect the wrapper response to contain `"ok":true`.
3. `ChatClient.logout`
   - Clear login state left by a previous failed scenario.
4. `ChatClient.login`
   - Log in as the group owner by default.
   - Expect `"ok":true`.

Every scenario ends with a normal ordered `ChatClient.logout` sampler.

## Scenario Categories

The first GroupManager suite contains six scenario plans.

### 1. Group Info Query

File:

```text
jmeter/data/group-manager/group-info-query.jmx
```

Purpose:

Verify fixture group discovery and read APIs without mutating group state.

Flow:

1. `ChatGroupManager.getGroupWithId`
   - Verify the local-cache lookup API is callable.
   - Do not require the local cache to already contain the fixture group.
2. `ChatGroupManager.fetchGroupInfoWithoutMembersFromServer`
   - Verify the server response contains `groupId`.
3. `ChatGroupManager.fetchMemberListFromServer`
   - Verify both prepared members appear.
   - Verify the prepared non-member does not appear.
4. `ChatGroupManager.fetchJoinedGroupsFromServer`
   - Verify the API is callable for the owner account.
5. `ChatGroupManager.fetchPublicGroupsFromServer`
   - Verify the public-group list API is callable.

### 2. Group Member Management

File:

```text
jmeter/data/group-manager/group-member-management.jmx
```

Purpose:

Verify adding and removing a prepared non-member from the fixture group.

Flow:

1. `ChatGroupManager.addMembers` with `GROUP_NON_MEMBER_USERNAME_1`.
2. `ChatGroupManager.fetchMemberListFromServer`
   - Verify the added user appears.
3. `ChatGroupManager.removeMembers` with the same user.
4. `ChatGroupManager.fetchMemberListFromServer`
   - Verify the user is absent again.

### 3. Group Metadata Lifecycle

File:

```text
jmeter/data/group-manager/group-metadata-lifecycle.jmx
```

Purpose:

Verify owner-only metadata updates for the fixture group.

Flow:

1. `ChatGroupManager.changeGroupName`.
2. `ChatGroupManager.changeGroupDescription`.
3. `ChatGroupManager.updateGroupAnnouncement`.
4. `ChatGroupManager.fetchAnnouncementFromServer`
   - Verify the announcement equals the runtime value.
5. `ChatGroupManager.updateGroupExtension`.
6. `ChatGroupManager.updateGroupAvatar`.
7. `ChatGroupManager.fetchGroupInfoWithoutMembersFromServer`
   - Verify the response includes the group and updated metadata values when
     the SDK response exposes them.

### 4. Group Moderation Lifecycle

File:

```text
jmeter/data/group-manager/group-moderation-lifecycle.jmx
```

Purpose:

Verify reversible moderation operations.

Flow:

1. `ChatGroupManager.muteMembers` for `GROUP_MEMBER_USERNAME_1`.
2. `ChatGroupManager.fetchMuteListFromServer`
   - Verify the member appears.
3. `ChatGroupManager.unMuteMembers`.
4. `ChatGroupManager.blockMembers` for `GROUP_NON_MEMBER_USERNAME_1`.
5. `ChatGroupManager.fetchBlockListFromServer`
   - Verify the user appears.
6. `ChatGroupManager.unblockMembers`.
7. `ChatGroupManager.addAllowList` for `GROUP_MEMBER_USERNAME_2`.
8. `ChatGroupManager.fetchAllowListFromServer`
   - Verify the member appears.
9. `ChatGroupManager.removeAllowList`.

### 5. Group Create Destroy Lifecycle

File:

```text
jmeter/data/group-manager/group-create-destroy-lifecycle.jmx
```

Purpose:

Verify SDK group creation and destruction with runtime group ID extraction.

Flow:

1. `ChatGroupManager.createGroupEx`
   - Use `inviteNeedConfirm:false`.
   - Extract `createdGroupId`.
2. `ChatGroupManager.fetchGroupInfoWithoutMembersFromServer`
   - Verify the temporary group can be queried.
3. `ChatGroupManager.destroyGroup`
   - Destroy the temporary group.

### 6. Group Shared File Lifecycle

File:

```text
jmeter/data/group-manager/group-shared-file-lifecycle.jmx
```

Purpose:

Verify shared-file upload, listing, download, and removal through the measured
app `FileHelper` path helpers.

Flow:

1. `ChatGroupManager.uploadGroupSharedFile`
   - Send `fixtureName`.
   - Use `fileTimeout`, defaulting to 60000 ms.
2. `ChatGroupManager.fetchGroupFileListFromServer`
   - Extract `groupFileId`.
3. `ChatGroupManager.downloadGroupSharedFile`
   - Send `saveFilename`.
   - Use `fileTimeout`.
4. `ChatGroupManager.removeGroupSharedFile`.

If the environment lacks shared-file capability or native file-transfer setup,
classify the failure before weakening assertions or removing the scenario.
