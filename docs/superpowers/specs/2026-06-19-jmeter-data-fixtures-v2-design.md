# JMeter Data Fixtures V2 Design

## Purpose

Design a small, implementable data fixture tool that prepares Easemob REST API
data for tests.

This second version deliberately avoids broad compatibility work. It does not
adapt existing JMeter variables, does not depend on measured app dispatch
coverage, and does not prepare conversation data. The only scope is:

- fixed test account preparation and deletion
- fixed relationship reset for contacts, groups, and chat rooms
- local data outputs that other tools can consume

## Non-Goals

- No JMeter `.jmx` migration or variable compatibility.
- No React Native app changes.
- No conversation creation or deletion.
- No dynamic account pool management.
- No support for multiple config paths.
- No persistent REST response archives in data output files.

## Location

Create an independent Node.js sub-package under `jmeter/`:

```text
jmeter/data-fixtures/
  package.json
  config.example.cjs
  config.local.cjs          # git ignored
  .gitignore
  README.md
  src/
    config.js
    fixture-users.js
    env-file.js
    logger.js
    rest-client.js
    prepare-accounts.js
    reset-relationships.js
  .state/                   # git ignored
    accounts.env
    relationships.env
    logs/
```

The package is independent from `forward_server/` and `measured_app/`.

## Commands

Run commands from `jmeter/data-fixtures/`:

```bash
yarn prepare:accounts
yarn delete:accounts
yarn reset:relationships
```

`prepare:accounts` and `delete:accounts` are two modes of the account
preparation script. `reset:relationships` is the high-frequency script that can
run before test cases.

## Configuration

The repository provides a committed template:

```text
config.example.cjs
```

Users create the ignored local config:

```text
config.local.cjs
```

Template shape:

```js
module.exports = {
  restHost: 'http://a1.easemob.com',
  restOrgName: '1135220126133718',
  restAppName: 'demo',
  restAppToken: '',

  userPrefix: 'wayang_demo',
  defaultPassword: 'qwerty',
  requestTimeoutMs: 30000,
};
```

Rules:

- `config.local.cjs` is the only supported runtime config path.
- `restAppToken` is required and must not be printed or written to output data
  files.
- `APP_KEY` is derived as `${restOrgName}#${restAppName}`.
- `userPrefix` is the only account-name collision escape hatch.
- `defaultPassword` is used for every fixed fixture account.
- `requestTimeoutMs` is optional and defaults to 30000.

## Account Model

The fixture user set is fixed at 16 accounts. Usernames are generated as
`{userPrefix}_001` through `{userPrefix}_016`. The role-to-number mapping is
stable.

```text
PRIMARY_USERNAME={userPrefix}_001

CONTACT_FRIEND_USERNAME={userPrefix}_002
CONTACT_NON_FRIEND_USERNAME={userPrefix}_003
CONTACT_EXISTING_FRIEND_USERNAME={userPrefix}_004
CONTACT_FRIEND_TO_ADD_USERNAME={userPrefix}_005

CHAT_PEER_USERNAME={userPrefix}_006

GROUP_OWNER_USERNAME={userPrefix}_007
GROUP_MEMBER_USERNAME_1={userPrefix}_008
GROUP_MEMBER_USERNAME_2={userPrefix}_009
GROUP_NON_MEMBER_USERNAME_1={userPrefix}_010
GROUP_NON_MEMBER_USERNAME_2={userPrefix}_011

ROOM_OWNER_USERNAME={userPrefix}_012
ROOM_MEMBER_USERNAME_1={userPrefix}_013
ROOM_MEMBER_USERNAME_2={userPrefix}_014
ROOM_NON_MEMBER_USERNAME_1={userPrefix}_015
ROOM_NON_MEMBER_USERNAME_2={userPrefix}_016
```

`CHAT_PEER_USERNAME` is retained as an account fixture, but conversation data is
not prepared in V2.

## Account Preparation

`yarn prepare:accounts` performs low-frequency account preparation:

1. Load `config.local.cjs`.
2. Validate required config fields.
3. Generate the fixed 16-account list.
4. Register missing accounts with `POST /users`.
5. If registration reports that an account already exists, query it and reset
   its password with `PUT /users/{username}/password`.
6. Fail on any other unexpected REST error.
7. Write `.state/accounts.env`.
8. Write a log file under `.state/logs/`.

The script is allowed to perform extra REST calls because account preparation is
not expected to run before every test case.

## Account Deletion

`yarn delete:accounts` performs low-frequency account cleanup:

1. Load `config.local.cjs`.
2. Validate required config fields.
3. Generate the fixed 16-account list.
4. If `.state/relationships.env` exists, delete its `GROUP_ID` and `ROOM_ID`
   before deleting accounts.
5. Treat already-missing relationship resources as successfully cleaned.
6. Delete each account with `DELETE /users/{username}`.
7. Treat already-missing accounts as successfully cleaned.
8. Fail on unexpected REST errors.
9. Remove `.state/accounts.env` and `.state/relationships.env` if deletion
   succeeds.
10. Write a log file under `.state/logs/`.

The REST batch deletion endpoint is not used because it deletes service-selected
users and is unsafe for known fixture accounts.

## Accounts Output

The account output file is a flat `.env` style key-value file:

```text
.state/accounts.env
```

Example:

```properties
APP_KEY=1135220126133718#demo
USER_PREFIX=wayang_demo
DEFAULT_PASSWORD=qwerty

PRIMARY_USERNAME=wayang_demo_001
PRIMARY_PASSWORD=qwerty

CONTACT_FRIEND_USERNAME=wayang_demo_002
CONTACT_NON_FRIEND_USERNAME=wayang_demo_003
CONTACT_EXISTING_FRIEND_USERNAME=wayang_demo_004
CONTACT_FRIEND_TO_ADD_USERNAME=wayang_demo_005

CHAT_PEER_USERNAME=wayang_demo_006

GROUP_OWNER_USERNAME=wayang_demo_007
GROUP_MEMBER_USERNAME_1=wayang_demo_008
GROUP_MEMBER_USERNAME_2=wayang_demo_009
GROUP_NON_MEMBER_USERNAME_1=wayang_demo_010
GROUP_NON_MEMBER_USERNAME_2=wayang_demo_011

ROOM_OWNER_USERNAME=wayang_demo_012
ROOM_MEMBER_USERNAME_1=wayang_demo_013
ROOM_MEMBER_USERNAME_2=wayang_demo_014
ROOM_NON_MEMBER_USERNAME_1=wayang_demo_015
ROOM_NON_MEMBER_USERNAME_2=wayang_demo_016
```

This file is a data output for other tools. It must not include run status,
timestamps, REST response bodies, or debug context. Those belong in log files.

## Relationship Reset

`yarn reset:relationships` performs high-frequency relationship reset:

1. Load `config.local.cjs`.
2. Validate required config fields.
3. Generate the fixed 16-account list.
4. Verify all 16 accounts exist through REST.
5. Fail immediately if any account is missing.
6. Read old `.state/relationships.env` if it exists.
7. Delete old `GROUP_ID` and `ROOM_ID` from the previous reset.
8. Remove the old `.state/relationships.env` after those old resources have
   been cleaned, because it no longer represents current remote state.
9. Rebuild contact relationships.
10. Create a new group.
11. Create a new chat room.
12. Write a fresh `.state/relationships.env`.
13. If any step after new group or room creation fails, delete the newly created
    resources before rethrowing the failure.
14. Write a log file under `.state/logs/`.

The reset script does not create accounts. Missing accounts mean the user should
run `yarn prepare:accounts` first.

## Contact Target State

Before adding target friends, the reset script attempts to delete the primary
account's friend relationship with each contact candidate:

```text
CONTACT_FRIEND_USERNAME
CONTACT_NON_FRIEND_USERNAME
CONTACT_EXISTING_FRIEND_USERNAME
CONTACT_FRIEND_TO_ADD_USERNAME
```

The script also deletes the reciprocal `CONTACT_FRIEND_USERNAME ->
PRIMARY_USERNAME` relationship before rebuilding it. Other contact roles are
single-direction fixtures from the `PRIMARY_USERNAME` perspective.

Missing friend relationships are treated as already clean.

After cleanup, the script adds these target contact relationships:

```text
PRIMARY_USERNAME -> CONTACT_FRIEND_USERNAME
CONTACT_FRIEND_USERNAME -> PRIMARY_USERNAME
PRIMARY_USERNAME -> CONTACT_EXISTING_FRIEND_USERNAME
```

The final contact state has one stable bidirectional friend for common messaging
scenarios. Other contact fixtures are prepared only from the `PRIMARY_USERNAME`
account's contact-list perspective.

```text
Bidirectional stable friends:
PRIMARY_USERNAME and CONTACT_FRIEND_USERNAME

Primary account-only contact:
PRIMARY_USERNAME -> CONTACT_EXISTING_FRIEND_USERNAME

Not in primary account contacts:
CONTACT_NON_FRIEND_USERNAME
CONTACT_FRIEND_TO_ADD_USERNAME
```

`CONTACT_FRIEND_USERNAME` is intended for common send-message scenarios where
both accounts should see each other as friends.
`CONTACT_EXISTING_FRIEND_USERNAME` is intended for tests that delete an existing
friend. `CONTACT_FRIEND_TO_ADD_USERNAME` is intended for tests that add a new
friend.

## Group Target State

Each relationship reset deletes the previous group, then creates a new group.
The script does not perform additional join or leave operations.

Create group request:

```text
POST /chatgroups
```

Target state:

```text
owner = GROUP_OWNER_USERNAME
members = [
  GROUP_MEMBER_USERNAME_1,
  GROUP_MEMBER_USERNAME_2
]
non-members = [
  GROUP_NON_MEMBER_USERNAME_1,
  GROUP_NON_MEMBER_USERNAME_2
]
```

The new group ID is read from `data.groupid`.

## Chat Room Target State

Each relationship reset deletes the previous chat room, then creates a new chat
room. The script does not perform additional join or leave operations.

Create chat room request:

```text
POST /chatrooms
```

Target state:

```text
owner = ROOM_OWNER_USERNAME
members = [
  ROOM_MEMBER_USERNAME_1,
  ROOM_MEMBER_USERNAME_2
]
non-members = [
  ROOM_NON_MEMBER_USERNAME_1,
  ROOM_NON_MEMBER_USERNAME_2
]
```

The new room ID is read from `data.id`.

## Relationships Output

The relationship output file is a flat `.env` style key-value file:

```text
.state/relationships.env
```

Example:

```properties
APP_KEY=1135220126133718#demo
USER_PREFIX=wayang_demo

PRIMARY_USERNAME=wayang_demo_001
CONTACT_FRIEND_USERNAME=wayang_demo_002
CONTACT_NON_FRIEND_USERNAME=wayang_demo_003
CONTACT_EXISTING_FRIEND_USERNAME=wayang_demo_004
CONTACT_FRIEND_TO_ADD_USERNAME=wayang_demo_005

GROUP_ID=317080531435524
GROUP_OWNER_USERNAME=wayang_demo_007
GROUP_MEMBER_USERNAME_1=wayang_demo_008
GROUP_MEMBER_USERNAME_2=wayang_demo_009
GROUP_NON_MEMBER_USERNAME_1=wayang_demo_010
GROUP_NON_MEMBER_USERNAME_2=wayang_demo_011

ROOM_ID=317080532484098
ROOM_OWNER_USERNAME=wayang_demo_012
ROOM_MEMBER_USERNAME_1=wayang_demo_013
ROOM_MEMBER_USERNAME_2=wayang_demo_014
ROOM_NON_MEMBER_USERNAME_1=wayang_demo_015
ROOM_NON_MEMBER_USERNAME_2=wayang_demo_016
```

The script writes this file only after all relationship reset steps succeed.
Failures must not leave a new partial `relationships.env`. If the old
relationship resources were already deleted during a failed reset, the current
`relationships.env` must also be removed so consumers do not read stale IDs.

## REST API Dependencies

The design depends only on REST shapes already validated in
`docs/superpowers/references/2026-06-18-easemob-rest-api-validation.md`.

Required operations:

- `POST /users`
- `GET /users/{username}`
- `PUT /users/{username}/password`
- `DELETE /users/{username}`
- `POST /users/{owner_username}/contacts/users/{friend_username}`
- `DELETE /users/{owner_username}/contacts/users/{friend_username}`
- `POST /chatgroups`
- `DELETE /chatgroups/{group_id}`
- `POST /chatrooms`
- `DELETE /chatrooms/{chatroom_id}`

The implementation should keep REST path construction inside `rest-client.js`.

## Logging

Each script execution writes one timestamped log file:

```text
.state/logs/prepare-accounts-YYYYMMDD-HHmmss-SSS-pidPID.log
.state/logs/delete-accounts-YYYYMMDD-HHmmss-SSS-pidPID.log
.state/logs/reset-relationships-YYYYMMDD-HHmmss-SSS-pidPID.log
```

Console output should stay concise:

- command result
- output data file path, when applicable
- log file path
- key generated IDs for relationship reset

The log file should include:

- configuration file path loaded
- current stage
- account usernames being created, repaired, checked, or deleted
- old group and room IDs being cleaned
- new `GROUP_ID` and `ROOM_ID`
- output file paths
- REST method and path for failures
- HTTP status for failures
- network error name and message for failures before an HTTP response exists
- key REST error fields such as `error`, `exception`, and `error_description`

The log must never print `restAppToken`. If a debug mode is later added, token
redaction remains mandatory.

## Error Handling

The scripts use strict failure semantics.

Fail immediately for:

- missing `config.local.cjs`
- missing required config field
- empty `restAppToken`
- missing account during relationship reset
- unexpected REST status
- request timeout or network failure
- missing group ID in group create response
- missing room ID in chat room create response
- inability to write output or log files

Allowed non-fatal cases:

- registering an already-existing account, if password reset succeeds
- deleting an already-missing account
- deleting an already-missing friend relationship
- deleting an already-missing previous group
- deleting an already-missing previous chat room

Relationship reset cleanup rule:

- If a reset fails after creating a new group or chat room, the script must
  attempt to delete every newly created resource before exiting non-zero.
- If cleanup also fails, the log must include both the original failure and the
  cleanup failure.

On failure, the script exits non-zero and writes enough log context to diagnose
the failed stage.

## Implementation Notes

- Prefer plain JavaScript and Node.js built-ins.
- Use Node 18+ built-in `fetch`.
- Use a request timeout with `AbortSignal.timeout(requestTimeoutMs)`.
- Avoid third-party dependencies unless implementation proves they are needed.
- Keep output `.env` serialization deterministic and stable.
- Write output files atomically by writing a temporary file and renaming it.
- Keep `config.local.cjs`, `.state/`, and logs out of git.

## Success Criteria

The design is implemented when:

- `yarn prepare:accounts` can create or repair the fixed 16 accounts.
- `yarn delete:accounts` can delete the fixed 16 accounts one by one.
- `yarn reset:relationships` fails if accounts are missing.
- `yarn reset:relationships` recreates contacts, one group, and one chat room
  into the target state.
- failed relationship resets do not leave untracked newly created group or room
  resources when cleanup succeeds.
- failed relationship resets do not leave a stale current `relationships.env`
  after deleting old remote resources.
- `yarn delete:accounts` removes relationship output and cleans previous group
  and room resources before deleting users.
- `.state/accounts.env` and `.state/relationships.env` contain only necessary
  key-value fixture data.
- Every command writes a useful log file.
- No app token or local state file is committed.
