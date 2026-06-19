# JMeter User Info Manager Scenarios Design

## Context

`measured_app` exposes `react-native-chat-sdk` APIs through WebSocket commands,
and JMeter drives those commands through `forward_server`. Existing
UserInfoManager coverage lives in `jmeter/data/rn-sdk-user-info-manager.jmx`;
it is a wide API coverage plan with manually editable variables.

This design applies the closed-loop scenario style already used by
ChatManager, ContactManager, GroupManager, and ChatRoomManager to
ChatUserInfoManager. The generated plans consume prepared fixture accounts,
extract runtime values from SDK responses, and keep generated JMX diffs stable.

## Goal

Add a new set of ChatUserInfoManager scenario JMeter plans that exercise common
user-info workflows with prepared fixture data and runtime variables.

Each scenario plan should be independently runnable after fixture preparation
and should follow this shape:

1. load fixture `.env` data;
2. initialize Chat SDK;
3. log out to clear stale login state;
4. log in as the primary fixture account;
5. execute the target ChatUserInfoManager workflow;
6. log out.

Scenario files live under:

```text
jmeter/data/user-info-manager/
```

The existing `jmeter/data/rn-sdk-user-info-manager.jmx` coverage plan is not
changed by this design.

## Non-Goals

- Do not replace existing API coverage JMeter plans.
- Do not write runtime user-info values back into `.jmx` files.
- Do not require manual edits to user-info variables after every run.
- Do not design scenario suites for other managers in this phase.
- Do not create fixture accounts from scenario plans. Use
  `jmeter/data-fixtures/`.
- Do not add REST fixture topology unless the current fixture accounts are not
  sufficient.
- Do not use setUp Thread Groups or tearDown Thread Groups for init, login, or
  logout. They remain ordinary ordered samplers in each scenario.

## Fixture Usage Contract

Before running ChatUserInfoManager scenarios, the caller prepares data with:

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
CONTACT_FRIEND_USERNAME
CHAT_PEER_USERNAME
GROUP_OWNER_USERNAME
ROOM_OWNER_USERNAME
```

Required keys from `relationships.env`:

```text
APP_KEY
PRIMARY_USERNAME
CONTACT_FIXTURE_READY
```

The loader verifies that shared keys match across both files. A mismatch means
the relationship state was generated for a different account set and the
scenario must fail with `PRECONDITION_FAILED`.

The loader maps fixture keys to scenario variables:

```text
appKey=${APP_KEY}
username=${PRIMARY_USERNAME}
password=${PRIMARY_PASSWORD}
defaultPassword=${DEFAULT_PASSWORD}
primaryUserId=${PRIMARY_USERNAME}
contactFriendUserId=${CONTACT_FRIEND_USERNAME}
chatPeerUserId=${CHAT_PEER_USERNAME}
groupOwnerUserId=${GROUP_OWNER_USERNAME}
roomOwnerUserId=${ROOM_OWNER_USERNAME}
queryUserIds=${PRIMARY_USERNAME},${CONTACT_FRIEND_USERNAME},${CHAT_PEER_USERNAME}
```

The fixture reset marker is used as a lightweight proof that the state files
belong to a current prepared data set:

```text
CONTACT_FIXTURE_READY=true
```

## Runtime Variables

Generated `.jmx` files keep stable placeholders and update runtime values
during execution. Runtime variables are not saved back to generated JMX files.

Examples:

```text
primaryUserId
contactFriendUserId
chatPeerUserId
queryUserIds
nickName
avatarUrl
email
phone
gender
sign
birth
ext
```

Request payload field names stay aligned with the measured app WebSocket
protocol. `fetchUserInfoById` sends `ids` because the current wrapper parses
`info.ids` as a comma-separated string. `updateOwnUserInfo` sends `nickName`,
`avatarUrl`, `email`, `phone`, `gender`, `sign`, `birth`, and `ext`, matching
the current wrapper field mapping.

## Precondition Failures

Fixture load and response extraction failures use `PRECONDITION_FAILED`, mark
the sampler failed, and stop the current JMeter thread. This prevents later
samplers from calling SDK APIs with empty usernames or assertion values.

The generated Groovy helpers recursively inspect SDK response values for common
field names such as `userId`, `username`, `nickName`, `avatarUrl`, `mail`,
`phone`, `sign`, `birth`, and `ext`. They also include map keys while
flattening response strings so user IDs can be asserted even when SDK responses
are keyed by username.

## Generated JMX Maintenance

ChatUserInfoManager scenario `.jmx` files are generated artifacts. Direct edits
to `jmeter/data/user-info-manager/*.jmx` are not the maintenance path because
regeneration will overwrite them.

The generator owns XML escaping, sampler creation, assertions, shared Groovy
helpers, fixture `.env` loading, and scenario definitions:

```text
jmeter/tools/user_info_manager_scenarios/
```

## Shared Scenario Prologue

Every scenario begins with these ordered samplers:

1. `Load fixture env`
   - Read and validate `accounts.env` and `relationships.env`.
   - Set `appKey`, `username`, `password`, `primaryUserId`, and query fixture
     variables.
2. `ChatClient.init`
   - Open the WebSocket connection.
   - Expect the wrapper response to contain `"ok":true`.
3. `ChatClient.logout`
   - Clear login state left by a previous failed scenario.
4. `ChatClient.login`
   - Log in as the primary fixture account.
   - Expect `"ok":true`.

Every scenario ends with a normal ordered `ChatClient.logout` sampler.

## Scenario Categories

The first ChatUserInfoManager suite contains three scenario plans.

### 1. Own Info Query

File:

```text
jmeter/data/user-info-manager/user-info-own-query.jmx
```

Workflow:

1. Call `ChatUserInfoManager.fetchOwnInfo`.
2. Assert the response contains `primaryUserId`.

### 2. Batch User Info Query

File:

```text
jmeter/data/user-info-manager/user-info-batch-query.jmx
```

Workflow:

1. Call `ChatUserInfoManager.fetchUserInfoById` with `queryUserIds`.
2. Assert the response contains the primary user, contact friend, and chat peer
   fixture user IDs.

### 3. Own Info Update Lifecycle

File:

```text
jmeter/data/user-info-manager/user-info-update-lifecycle.jmx
```

Workflow:

1. Set run-scoped profile values.
2. Call `ChatUserInfoManager.updateOwnUserInfo`.
3. Call `ChatUserInfoManager.fetchOwnInfo`.
4. Assert the response contains the updated nickname, avatar URL, email, phone,
   signature, birth date, and extension value.

## Documentation

Update `jmeter/README.md` to document generation and execution commands for the
new `jmeter/data/user-info-manager/` suite.
