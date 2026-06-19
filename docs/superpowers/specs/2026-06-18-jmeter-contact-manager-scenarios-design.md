# JMeter Contact Manager Scenarios Design

## Context

`measured_app` exposes `react-native-chat-sdk` APIs through WebSocket commands,
and JMeter drives those commands through `forward_server`. Existing JMeter
plans under `jmeter/data/` are API coverage plans. They contain many samplers
in one file and use `User Defined Variables` for values such as user names,
pagination cursors, and common request parameters.

That coverage style is useful, but contact-related APIs are easier to verify
with closed-loop scenarios. A scenario should load prepared fixture accounts,
verify the contact state it depends on, extract runtime identifiers from
previous API responses when needed, use those identifiers in later API calls,
and clean up state created by the scenario when practical.

This design applies the same scenario style already used by ChatManager to
ContactManager. The general JMeter structure, generated-plan maintenance model,
runtime-variable handling, failure classification, and CLI/UI behavior should
match the ChatManager scenario suite unless this document explicitly says
otherwise.

ContactManager data preparation is intentionally delegated to
`docs/superpowers/specs/2026-06-19-jmeter-data-fixtures-v2-design.md`. The
ContactManager scenario plans do not create fixture accounts and do not rebuild
baseline contact relationships. They consume the fixture outputs and fail fast
when the prepared state is missing or stale.

## Goal

Add a new set of ContactManager scenario JMeter plans that exercise typical
contact workflows with prepared fixture data and runtime variables instead of
long-lived manually edited contact state.

Each scenario plan should be independently runnable after fixture preparation
and should follow this shape:

1. load fixture `.env` data;
2. initialize Chat SDK;
3. log in as the required fixture account;
4. verify prerequisite contact data for the target workflow;
5. execute the target ContactManager workflow;
6. clean up data created by the scenario when practical;
7. log out.

Scenario files live under:

```text
jmeter/data/contact-manager/
```

The existing `jmeter/data/rn-sdk-contact-manager.jmx` coverage plan is not
changed by this design.

## Non-Goals

- Do not replace the existing API coverage JMeter plans.
- Do not write runtime contact IDs or cursors back into `.jmx` files.
- Do not require manual edits to contact-related variables after every run.
- Do not design scenario suites for ChatManager, GroupManager, RoomManager, or
  other managers in this phase.
- Do not require every ContactManager edge case to be covered before the
  scenario pattern is useful.
- Do not create accounts, groups, rooms, or baseline contact relationships from
  ContactManager scenario plans. Use `jmeter/data-fixtures/` for that.
- Do not hide prerequisite failures. If a required fixture account or prepared
  contact relationship is missing, the scenario should fail.
- Do not use setUp Thread Groups or tearDown Thread Groups for init, login, or
  logout. They remain ordinary ordered samplers in each scenario.
- Do not add pending-invitation fixture preparation to
  `jmeter/data-fixtures/` in this phase. Invitation scenarios consume the
  prepared fixture user IDs directly.

## Fixture Usage Contract

Before running ContactManager scenarios, the caller prepares data with:

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

Both paths should be configurable with JMeter properties so CLI and UI runs can
use alternate state directories when needed:

```text
accountsEnvPath
relationshipsEnvPath
```

If the properties are not provided, the generated JMX should default to the
paths above, relative to the repository root used by the JMeter process.

Every ContactManager scenario begins with a normal ordered JSR223 sampler named
`Load fixture env`. It reads both `.env` files, validates required keys, and
puts stable JMeter variables into `vars`. This is part of the scenario thread,
not a setUp Thread Group.

Required keys from `accounts.env`:

```text
APP_KEY
DEFAULT_PASSWORD
PRIMARY_USERNAME
PRIMARY_PASSWORD
CONTACT_FRIEND_USERNAME
CONTACT_NON_FRIEND_USERNAME
CONTACT_EXISTING_FRIEND_USERNAME
CONTACT_FRIEND_TO_ADD_USERNAME
CONTACT_INVITATION_SMOKE_USERNAME
```

Required keys from `relationships.env`:

```text
APP_KEY
PRIMARY_USERNAME
CONTACT_FRIEND_USERNAME
CONTACT_NON_FRIEND_USERNAME
CONTACT_EXISTING_FRIEND_USERNAME
CONTACT_FRIEND_TO_ADD_USERNAME
CONTACT_INVITATION_SMOKE_USERNAME
CONTACT_FIXTURE_READY
```

The loader should verify that shared keys match across both files. A mismatch
means the relationship state was generated for a different account set and the
scenario must fail with `PRECONDITION_FAILED`.

The loader maps fixture keys to scenario variables:

```text
appKey=${APP_KEY}
username=${PRIMARY_USERNAME}
password=${PRIMARY_PASSWORD}
defaultPassword=${DEFAULT_PASSWORD}
primaryUserId=${PRIMARY_USERNAME}
contactFriendUserId=${CONTACT_FRIEND_USERNAME}
contactNonFriendUserId=${CONTACT_NON_FRIEND_USERNAME}
contactExistingFriendUserId=${CONTACT_EXISTING_FRIEND_USERNAME}
contactFriendToAddUserId=${CONTACT_FRIEND_TO_ADD_USERNAME}
contactInvitationSmokeUserId=${CONTACT_INVITATION_SMOKE_USERNAME}
```

Scenario-specific aliases such as `contactUserId`, `targetUserId`,
`blockedUserId`, `friendUserId`, or `existingNonFriendId` may be set at runtime
from these fixture variables. Request payload field names must still stay
aligned with the measured app WebSocket protocol. For example, APIs that read
`info.username` should continue to send `username`, not a scenario-specific
field name.

The fixture reset guarantees this primary-account contact state:

```text
PRIMARY_USERNAME has contacts:
  CONTACT_FRIEND_USERNAME
  CONTACT_EXISTING_FRIEND_USERNAME

PRIMARY_USERNAME does not have contacts:
  CONTACT_NON_FRIEND_USERNAME
  CONTACT_FRIEND_TO_ADD_USERNAME
  CONTACT_INVITATION_SMOKE_USERNAME

CONTACT_FRIEND_USERNAME and PRIMARY_USERNAME are bidirectional friends.
CONTACT_EXISTING_FRIEND_USERNAME is a primary-account-only contact.
```

The scenario suite relies only on that contact state. It does not rely on group
or chat room fixture outputs.

The loader must also verify this marker key from `relationships.env`:

```text
CONTACT_FIXTURE_READY=true
```

This marker is the lightweight initial-state proof for all ContactManager
scenarios. If it is missing or not `true`, fail fast with
`PRECONDITION_FAILED`, stop the current JMeter thread, and instruct the caller
to run or repair `yarn reset:relationships`. One failed contact fixture reset
means the whole contact fixture is invalid; individual scenario plans should
not add extra expensive precondition contact-list calls for states covered by
this marker.

Scenarios that mutate fixture relationships are still independently runnable,
but their baseline is restored by running `yarn reset:relationships` again.
The generator README should state that `reset:relationships` is the supported
way to return to the baseline before rerunning a scenario or running the whole
suite.

If a scenario requires data not provided by `jmeter/data-fixtures/`, the
implementation must pause and confirm the additional fixture requirement before
adding it to the scenario design or generator.

## Runtime Variables

JMeter scenario plans should keep stable placeholders in the `.jmx` files and
update their values at runtime.

For simple response shapes, use JSON Extractor where it is clear and reliable.
For nested, variant, or SDK-specific response shapes, use a JSR223
PostProcessor and write variables with `vars.put(...)`.

Examples of runtime variables:

```text
primaryUserId
contactUserId
targetUserId
contactFriendUserId
contactNonFriendUserId
contactExistingFriendUserId
contactFriendToAddUserId
contactInvitationSmokeUserId
blockedUserId
friendUserId
existingNonFriendId
nonExistentUserId
cursor
nextCursor
pageSize
smallPageSize
remarkValue
remarkUpdatedValue
remarkClearedValue
reason
keepConversation
```

Runtime variables work in both JMeter UI and CLI runs. They exist only for the
current run and are not saved back to the `.jmx` file. This keeps Git diffs
stable while allowing later samplers to use values produced by earlier
samplers.

Variables must be set before the samplers that use them. The first
ContactManager scenario suite should keep one thread and sequential execution
so variable flow is predictable.

The main environment values should follow the ChatManager runtime override
pattern:

```text
url
port
timeout
topic
appKey
username
password
```

`appKey`, `username`, and `password` default from the fixture loader. CLI runs
may still override them with JMeter properties for debugging, but generated
scenario definitions should use fixture values by default.

`restAppToken` is not needed by these ContactManager scenario plans. The REST
token remains part of `jmeter/data-fixtures/config.local.cjs` and must not be
copied into generated JMX files or fixture output files.

## Precondition Failures

Prerequisite extraction must fail fast. If a loader or post-processor cannot
extract a required value such as `contactFriendUserId`, `targetUserId`,
`blockedUserId`, or `cursor`, it should mark the current sampler failed and
stop the current JMeter thread so later samplers do not call SDK APIs with
empty variables.

Use a consistent failure shape in JSR223 post-processors:

```groovy
prev.setSuccessful(false)
prev.setResponseCode('PRECONDITION_FAILED')
prev.setResponseMessage(
  'PRECONDITION_FAILED: contact-list-query requires contactFriendUserId from fixture env'
)
prev.setResponseData(
  'PRECONDITION_FAILED: contact-list-query requires contactFriendUserId from fixture env',
  'UTF-8'
)
ctx.getThread().stop()
```

`responseMessage` should contain a concise, complete reason. `responseData`
may include more detailed extraction context, such as the source API response,
the JSON path or script branch used, and the missing variable name.

Stopping the current JMeter thread is acceptable for precondition failures. The
next thread or next run should establish its own connection, initialize the SDK,
and log in again. Scenario plans should keep fixture load, init, login, target
workflow, cleanup, and logout as normal ordered samplers in the scenario thread.

## Failure Analysis

**Do not change tests, assertions, fixture data, or measured app code until the
failure is classified.**

Scenario failures must be analyzed and classified before changing test data,
loosening assertions, or modifying measured app code. A failed JMeter sampler
does not automatically mean the scenario is wrong, and it does not
automatically mean the measured app or SDK is broken.

When a scenario fails during implementation or verification, first classify the
failure into one of these categories:

- environment or account state, such as missing fixture files, stale
  relationships, expired login state, or missing service capability;
- test setup or JMeter scenario defect, such as extracting the wrong response
  field, using a variable before it is set, or asserting an immediate result
  for an eventually completed contact workflow;
- fixture setup defect, such as `reset:relationships` not producing the
  documented contact state;
- measured app wrapper defect, such as sending the wrong field name, using the
  wrong SDK method, or mishandling the unified callback response;
- expected SDK or service business behavior, such as a duplicate contact
  request, deleting a non-contact, accepting an invitation that no longer
  exists, or blocking a user already in the block list;
- suspected SDK bug, where the request is valid, the environment is ready, and
  the observed SDK behavior contradicts the SDK contract or stable prior
  behavior.

For significant failures or failures that would require changing scenario
semantics, wrapper behavior, fixture topology, or assertions, pause and confirm
the proposed classification and fix direction with the user before proceeding.

## Generated JMX Maintenance

The ContactManager scenario `.jmx` files should be generated artifacts, as the
ChatManager scenario files are. Direct edits to generated `.jmx` files are not
the maintenance path because regeneration will overwrite them.

The implementation plan should define the exact generator location, but it
should follow the ChatManager structure:

```text
jmeter/tools/contact_manager_scenarios/
```

The generator should own XML escaping, sampler creation, assertions, shared
JSR223 helpers, fixture `.env` loading, and scenario definitions. Generator
tests should verify scenario filenames, no setUp/tearDown Thread Groups,
stable protocol field names, required assertions, helper scripts, fixture key
validation, and XML parseability markers.

## Shared Scenario Prologue

Unless a scenario says otherwise, every scenario begins with these ordered
samplers:

1. `Load fixture env`
   - Read and validate `accounts.env` and `relationships.env`.
   - Set `appKey`, `username`, `password`, `defaultPassword`, `primaryUserId`,
     and all contact fixture variables.
2. `ChatClient.init`
   - Open the WebSocket connection.
   - Expect the wrapper response to contain `"ok":true`.
3. `ChatClient.logout`
   - Run as a normal sampler to clear login state left by a previous failed
     scenario.
   - Do not move this into a tearDown or setUp Thread Group.
4. `ChatClient.login`
   - Use `appKey`, `username`, and `password`.
   - Expect the wrapper response to contain `"ok":true` and the SDK login to
     succeed.

Every scenario ends with a normal ordered `ChatClient.logout` sampler unless it
has already logged out as part of a multi-account flow. Multi-account flows
must explicitly log out before changing `username` and logging in as another
fixture account.

## Scenario Categories

The first ContactManager suite contains seven scenario plans. Together they
cover contact list reads, remark updates, add request, prepared delete,
invitation request-path smoke, block-list operations, pagination, and low-risk
self-platform commands.

The server contact-list API appears only in `contact-list-query.jmx`. It is
relatively expensive and the fixture reset has already established which
fixture users are friends or non-friends. Other scenarios consume fixture
variables directly and verify only the target API surface they are designed to
cover.

### 1. Contact List Discovery And Query

File:

```text
jmeter/data/contact-manager/contact-list-query.jmx
```

Purpose:

Verify contact-list discovery and query APIs without mutating contact state.

Required variables:

```text
contactFriendUserId
contactExistingFriendUserId
contactNonFriendUserId
contactFriendToAddUserId
contactUserId
```

`contactUserId` should be set to `contactFriendUserId` after the fixture loader
runs.

Flow:

1. Run the shared scenario prologue.
2. `ChatContactManager.getAllContactsFromServer`
   - Verify `contactFriendUserId` and `contactExistingFriendUserId` appear.
   - Verify `contactNonFriendUserId` and `contactFriendToAddUserId` do not
     appear.
   - Store `contactUserId=${contactFriendUserId}`.
3. `ChatContactManager.fetchAllContacts`
   - Expect a list of contact objects.
   - Verify objects exist for `contactFriendUserId` and
     `contactExistingFriendUserId`.
4. `ChatContactManager.getAllContactsFromDB`
   - Verify the local DB string-list API can be called.
   - Expect a list shape.
   - Do not require this local list to match the server list.
5. `ChatContactManager.getAllContacts`
   - Verify the local object-list API can be called.
   - Expect a list shape.
   - Do not require this local object list to match the server object list.
6. `ChatContactManager.getContact`
   - Call with `username=${contactUserId}`.
   - Expect `"ok":true`.
   - If the returned value is present, verify its `userId` is `contactUserId`.
   - If the returned value is empty because the local cache does not contain
     the server-discovered contact, do not fail this scenario solely for
     server/local cache mismatch.
7. Logout.

Pass criteria:

- Fixture env data loads and matches the prepared relationship state.
- Server contact reads show the two prepared primary-account contacts.
- Server contact reads show the two prepared primary-account non-contacts are
  absent.
- Local read APIs are callable and return valid response structures.
- The scenario does not mutate contact state.

### 2. Contact Remark Lifecycle

File:

```text
jmeter/data/contact-manager/contact-remark-lifecycle.jmx
```

Purpose:

Verify setting, reading, updating, and clearing a contact remark for a prepared
existing contact.

Required variables:

```text
contactUserId
remarkValue
remarkUpdatedValue
remarkClearedValue
```

`contactUserId` should be `contactFriendUserId`. `remarkValue` and
`remarkUpdatedValue` should include a run-unique suffix such as `${__time()}`.
`remarkClearedValue` should be an empty string.

Flow:

1. Run the shared scenario prologue.
2. Set `contactUserId=${contactFriendUserId}` from the loaded fixture data.
3. `ChatContactManager.fetchAllContacts`
   - Verify an object exists with `userId == contactUserId`.
   - Do not require any initial `remark` value.
4. `ChatContactManager.setContactRemark`
   - Send `username=${contactUserId}` and `remark=${remarkValue}`.
   - Expect `"ok":true` and SDK success.
5. `ChatContactManager.fetchAllContacts`
   - Verify the contact object's `remark` equals `remarkValue`.
6. `ChatContactManager.setContactRemark`
   - Send `username=${contactUserId}` and `remark=${remarkUpdatedValue}`.
   - Expect `"ok":true` and SDK success.
7. `ChatContactManager.fetchAllContacts`
   - Verify the contact object's `remark` equals `remarkUpdatedValue`.
8. `ChatContactManager.getContact`
   - Call with `username=${contactUserId}`.
   - Expect `"ok":true`.
   - If a local value is present, verify its `userId` is `contactUserId`.
   - Do not require the local `remark` to equal `remarkUpdatedValue`.
9. `ChatContactManager.setContactRemark`
   - Send `username=${contactUserId}` and `remark=${remarkClearedValue}`.
   - Expect `"ok":true` and SDK success.
10. `ChatContactManager.fetchAllContacts`
    - Verify an object exists with `userId == contactUserId`.
    - Accept the SDK's cleared-remark representation: empty string,
      absent field, or null.
11. Logout.

Pass criteria:

- The prepared contact exists before mutation.
- `setContactRemark` can set, update, and clear the selected contact's remark.
- Server object reads verify the set and update values.
- Cleanup clears the scenario remark.

### 3. Contact Add Request Path And Prepared Delete Path

File:

```text
jmeter/data/contact-manager/contact-add-request-prepared-delete.jmx
```

Purpose:

Verify the `addContact` request path against a prepared non-friend and verify
the `deleteContact` result path against a prepared existing friend.

This scenario consumes fixture data directly. It does not create prerequisite
relationships, does not use REST, and does not call the server contact-list API.
It intentionally consumes `CONTACT_EXISTING_FRIEND_USERNAME` as the delete
target. Rerun `yarn reset:relationships` before rerunning this scenario or
before running scenarios that require the original baseline.

Required variables:

```text
addRequestTargetUserId
deletePreparedContactUserId
addContactReason
keepConversation
```

`addRequestTargetUserId` should be `contactFriendToAddUserId`.
`deletePreparedContactUserId` should be `contactExistingFriendUserId`.
`addContactReason` should include a run-unique suffix. `keepConversation`
should default to `false`.

Flow:

1. Run the shared scenario prologue.
2. Set `addRequestTargetUserId=${contactFriendToAddUserId}` and
   `deletePreparedContactUserId=${contactExistingFriendUserId}` from the
   loaded fixture data.
3. `ChatContactManager.addContact`
   - Send `username=${addRequestTargetUserId}` and
     `reason=${addContactReason}`.
   - Expect `"ok":true` and SDK success.
   - Do not assert that `addRequestTargetUserId` appears in the contact list;
     the target user must accept before the relationship exists.
4. `ChatContactManager.deleteContact`
   - Send `username=${deletePreparedContactUserId}` and
     `keepConversation=${keepConversation}`.
   - Expect `"ok":true` and SDK success.
5. Logout.

Pass criteria:

- `addContact` sends a friend request to a prepared non-friend.
- The scenario does not require add-contact to create an immediate contact
  relationship.
- `deleteContact` consumes the prepared delete target and returns through the
  unified wrapper response.
- The scenario performs no additional data preparation.

### 4. Contact Invitation Request Path Smoke

File:

```text
jmeter/data/contact-manager/contact-invitation-request-path-smoke.jmx
```

Purpose:

Verify `acceptInvitation` and `declineInvitation` using prepared fixture
accounts directly.

This is a request-path scenario that consumes prepared fixture users directly.
The fixture data provides known friend and non-friend user IDs. The scenario
does not create pending invitations, does not switch accounts, and does not
call `addContact`.

Required variables:

```text
acceptTargetUserId
declineTargetUserId
invitationReason
keepConversation
```

`acceptTargetUserId` should be `contactInvitationSmokeUserId`.
`declineTargetUserId` should be `contactNonFriendUserId`. Both are prepared
non-contacts of the primary account after relationship reset. The scenario may
also call one invitation API with `contactFriendUserId` to cover the existing
friend input class.

Flow:

1. Run the shared scenario prologue.
2. Set `acceptTargetUserId=${contactInvitationSmokeUserId}` and
   `declineTargetUserId=${contactNonFriendUserId}` from the loaded fixture
   data.
3. `ChatContactManager.acceptInvitation`
   - Send `username=${acceptTargetUserId}`.
   - Expect the request to reach the measured app wrapper and return
     `"ok":true`.
   - Do not require SDK business success because no pending invitation is
     prepared by this scenario.
4. `ChatContactManager.declineInvitation`
   - Send `username=${declineTargetUserId}`.
   - Expect the request to reach the measured app wrapper and return
     `"ok":true`.
   - Do not require SDK business success because no pending invitation is
     prepared by this scenario.
5. `ChatContactManager.acceptInvitation`
   - Send `username=${contactFriendUserId}`.
   - Expect `"ok":true`.
   - Treat SDK business responses such as "already friends" or
     "no pending invitation" as valid outputs when they are returned through
     the unified wrapper response.
6. Logout.

Pass criteria:

- The scenario consumes only fixture user IDs.
- `acceptInvitation` and `declineInvitation` both return through the unified
  wrapper response.
- SDK business failures caused by missing pending invitations are not scenario
  failures.

### 5. Block List Lifecycle

File:

```text
jmeter/data/contact-manager/contact-block-list-lifecycle.jmx
```

Purpose:

Verify adding a user to the block list, reading the server block list, removing
the user from the block list, and reading the server block list again.

Required variables:

```text
blockedUserId
```

`blockedUserId` should be `contactNonFriendUserId`. This avoids changing an
existing friend relationship.

Flow:

1. Run the shared scenario prologue.
2. Set `blockedUserId=${contactNonFriendUserId}` from the loaded fixture data.
3. `ChatContactManager.addUserToBlockList`
   - Send `username=${blockedUserId}`.
   - Expect `"ok":true` and SDK success.
4. `ChatContactManager.getBlockListFromServer`
   - Verify `blockedUserId` appears.
5. `ChatContactManager.removeUserFromBlockList`
   - Send `username=${blockedUserId}`.
   - Expect `"ok":true` and SDK success.
6. `ChatContactManager.getBlockListFromServer`
   - Verify `blockedUserId` no longer appears.
7. Logout.

Pass criteria:

- The block target is a prepared real non-friend user.
- Server block-list reads prove add and remove effects.
- The scenario removes the block-list entry it creates.

### 6. Pagination And Cursor Behavior

File:

```text
jmeter/data/contact-manager/contact-pagination-cursor.jmx
```

Purpose:

Verify paged contact fetch behavior using runtime `cursor` and `pageSize`
values against the two prepared primary-account contacts.

Required variables:

```text
pageSize
smallPageSize
cursor
nextCursor
secondPageCursor
contactFriendUserId
contactExistingFriendUserId
```

`pageSize` should default to `20`. `smallPageSize` should default to `1`.

Flow:

1. Run the shared scenario prologue.
2. `ChatContactManager.fetchContacts`
   - Send `cursor=` and `pageSize=${pageSize}`.
   - Expect a cursor result with a `list` array and a `cursor` field.
   - Verify returned list size is less than or equal to `pageSize`.
3. `ChatContactManager.fetchContacts`
   - Send `cursor=` and `pageSize=${smallPageSize}`.
   - Expect a cursor result with a `list` array and a `cursor` field.
   - Verify returned list size is less than or equal to `smallPageSize`.
   - Store returned cursor as `nextCursor`.
   - A non-empty `nextCursor` is expected only when the service indicates a
     second page. If `nextCursor` is empty while the returned page size is less
     than or equal to `smallPageSize`, record the response as SDK/service
     cursor behavior to classify during implementation instead of treating the
     design as a hard failure.
4. `ChatContactManager.fetchContacts`
   - Run this sampler only when `nextCursor` is non-empty.
   - Send `cursor=${nextCursor}` and `pageSize=${smallPageSize}`.
   - Expect a cursor result with a `list` array and a `cursor` field.
   - Verify returned list size is less than or equal to `smallPageSize`.
   - Verify the second page does not repeat the first page's user ID.
   - Store returned cursor as `secondPageCursor`.
5. Optional final page:
   - If `secondPageCursor` is non-empty, fetch the next page with
     `cursor=${secondPageCursor}` and `pageSize=${smallPageSize}`.
   - Expect a valid cursor result.
   - Do not require a third contact because the baseline only guarantees two.
6. Logout.

Pass criteria:

- Cursor responses expose a list and cursor field.
- Page size limits are respected.
- When a non-empty cursor is returned, the second small page advances instead
  of repeating the first page item.

### 7. Self Platform Smoke

File:

```text
jmeter/data/contact-manager/contact-self-platform-smoke.jmx
```

Purpose:

Verify low-risk ContactManager commands that do not naturally fit into a
closed-loop contact relationship lifecycle.

The only command in this scenario is
`ChatContactManager.getSelfIdsOnOtherPlatform`. Contact delegate registration
is not included because the generated dispatch route currently does not expose
`addContactManagerDelegate` or `removeContactManagerDelegate`.

Required variables:

```text
primaryUserId
```

Flow:

1. Run the shared scenario prologue.
2. `ChatContactManager.getSelfIdsOnOtherPlatform`
   - Expect the wrapper response to contain `"ok":true`.
   - Accept an empty list as valid when the account is not logged in on another
     platform.
   - If the response includes IDs, verify each item is a non-empty string.
3. Logout.

Pass criteria:

- The self-platform command reaches the measured app wrapper and returns
  through the unified response protocol.
- Empty and non-empty self-platform lists are both valid.

## Resolved Business Decisions

- ContactManager scenarios consume fixture outputs from `jmeter/data-fixtures/`
  and do not rebuild baseline data themselves.
- Fixture contact roles are the only approved contact data inputs for this
  phase.
- `CONTACT_FRIEND_USERNAME` is the stable read and remark target.
- `CONTACT_EXISTING_FRIEND_USERNAME` is the delete target and is allowed to be
  consumed by the delete lifecycle scenario.
- `CONTACT_NON_FRIEND_USERNAME` is the block-list target and one invitation
  decline smoke target.
- `CONTACT_FRIEND_TO_ADD_USERNAME` is the add-contact target.
- `CONTACT_INVITATION_SMOKE_USERNAME` is the invitation accept smoke target so
  add-contact pending request state does not overlap with invitation smoke
  inputs.
- `reset:relationships` is the supported baseline restoration mechanism.
- Invitation request-path smoke scenarios consume fixture user IDs directly; no
  pending-invitation fixture is required.
- The local-cache consistency scenario is intentionally removed from this first
  suite because its useful assertions overlap with the contact-list scenario
  and its cache timing semantics are too weak for a separate high-signal plan.
- If implementation discovers that another ContactManager scenario needs data
  not provided by fixture v2, stop and confirm the new fixture requirement
  before adding it.
