# JMeter REST Test Data Management Design

## Context

`measured_app` is driven by JMeter through `forward_server`, and most JMeter
plans authenticate a single SDK user before exercising one manager surface.
Several scenarios need pre-existing server data, such as contacts, a usable
group, a usable chat room, and users that are deliberately outside those
relationships.

Historically those prerequisites were prepared by hand. That is inconvenient
when the caller changes `appKey`, because contacts, group members, chat room
members, and message targets all belong to the current app. Manual replacement
also makes scenario failures harder to classify: a test can fail because the
SDK wrapper is wrong, because the JMeter plan is wrong, or simply because the
account state was not prepared.

This design adds a REST-driven fixture preparation layer for JMeter runs. The
fixture layer is independent from JMeter test plans. It prepares users and
relationship state with Easemob server-side REST APIs, writes local runtime
files, and passes only JMeter properties to CLI runs.

## Goals

- Prepare reusable test accounts for a given `appKey` without manual account
  editing.
- Reset contacts, groups, chat rooms, and message prerequisites before JMeter
  runs.
- Keep REST data preparation outside `.jmx` files.
- Keep existing JMeter plans unchanged in this phase.
- Support single-scenario execution for local debugging and suite execution
  for regression runs.
- Pass prepared data to JMeter through `-J` properties.
- Keep REST credentials out of JMeter plans and JMeter runtime properties.
- Make fixture preparation fail fast when required server state cannot be
  established.

## Non-Goals

- Do not modify existing `.jmx` files as part of this design.
- Do not call Easemob REST APIs from inside JMeter plans.
- Do not dynamically create or delete SDK users on every JMeter run.
- Do not commit real app tokens, account pools, generated group IDs, generated
  room IDs, logs, or runtime properties.
- Do not replace JMeter scenario-level runtime variables. A plan may still
  extract `messageId`, `threadId`, or other IDs during its own ordered run.
- Do not build a general-purpose REST API client library. The scripts should
  cover only fixture operations needed by the JMeter suite.

## Official REST References

Implementation should verify each concrete endpoint against the Easemob
server-side REST API documentation before wiring scripts. The relevant entry
points are:

- Server-side overview:
  `https://doc.easemob.com/document/server-side/overview.html`
- Authorized single-user registration:
  `https://doc.easemob.com/document/server-side/account_register_authorized_single.html`
- Batch user deletion:
  `https://doc.easemob.com/document/server-side/account_delete_batch.html`

Additional group, chat room, contact, and membership endpoints should be
looked up from the same server-side documentation area during implementation.
The design should not assume undocumented request paths.

## High-Level Architecture

The fixture system has four layers:

1. **Account provisioning**
   Low-frequency script that creates or verifies a reusable account pool for
   one `appKey`.
2. **Fixture reset**
   High-frequency script that uses the account pool to restore scenario
   prerequisites before a JMeter run.
3. **JMeter property generation**
   Runtime output that converts fixture state into `-J` properties.
4. **JMeter runners**
   CLI wrappers that execute one scenario or a suite of scenarios.

Data flow:

```text
provision-users.sh
  -> jmeter/runtime/rest-fixtures/users.env

reset-fixtures.sh --scenario <name>
  -> reads users.env
  -> calls Easemob REST APIs
  -> updates state.json
  -> writes jmeter-props.sh

run-scenario.sh <name>
  -> reset-fixtures.sh --scenario <name>
  -> source jmeter-props.sh
  -> jmeter -n -t <mapped .jmx> "${JMETER_PROPS[@]}"

run-suite.sh [scenario...]
  -> calls run-scenario.sh for each selected scenario
```

## Directory Layout

Add scripts and templates under:

```text
jmeter/tools/rest_fixtures/
  config.example.env
  users.example.env
  provision-users.sh
  reset-fixtures.sh
  destroy-fixtures.sh
  run-scenario.sh
  run-suite.sh
  lib/
    config.sh
    rest.sh
    state.sh
    jmeter_props.sh
```

Generated runtime files live outside source-controlled inputs:

```text
jmeter/runtime/rest-fixtures/
  users.env
  state.json
  jmeter-props.sh
  logs/
```

`jmeter/runtime/` should be ignored by Git. Templates such as
`config.example.env` and `users.example.env` should be committed with dummy
values only.

## Configuration Model

Runtime configuration has two categories.

Caller-provided environment:

```text
url              default localhost
port             default 8083
timeout          default 10000
topic            default rn
appKey           default 1135220126133718#demo
username         default asterisk001
password         default qwerty
restHost         required for REST scripts
restOrgName      required for REST scripts
restAppName      required for REST scripts
restAppToken     required for REST scripts
```

`url`, `port`, `timeout`, `topic`, `appKey`, `username`, and `password` may be
passed to JMeter as properties. `restHost`, `restOrgName`, `restAppName`, and
`restAppToken` are only for fixture scripts and must not be passed to JMeter.

Generated fixture data:

```text
users.env        stable account-role mapping for one appKey
state.json       generated server resource IDs and reset metadata
jmeter-props.sh  generated JMETER_PROPS array for JMeter CLI runs
```

The scripts should validate that the `APP_KEY` recorded in `users.env` matches
the requested `appKey`. A mismatch should fail before any REST mutation.

## Account Pool Handoff

The low-frequency account script communicates with runners through
`users.env`, not through command-line arguments.

`provision-users.sh` should:

- load REST configuration;
- create or verify the required account pool;
- write `jmeter/runtime/rest-fixtures/users.env`;
- preserve stable usernames for the same appKey and prefix;
- avoid deleting accounts by default.

`users.env` is a shell-readable file because the fixture scripts are Bash
entry points. It should be easy for a human to inspect, but it should be
treated as generated runtime data and not committed.

Example shape:

```bash
APP_KEY='1135220126133718#demo'
USER_PREFIX='wayang_demo'
DEFAULT_PASSWORD='qwerty'

PRIMARY_USERNAME='wayang_demo_001'
PRIMARY_PASSWORD='qwerty'

CONTACT_FRIEND_USERNAME='wayang_demo_002'
CONTACT_NON_FRIEND_USERNAME='wayang_demo_003'
CONTACT_DELETE_USERNAME='wayang_demo_004'
CONTACT_ADD_USERNAME='wayang_demo_005'

CHAT_PEER_USERNAME='wayang_demo_006'

GROUP_OWNER_USERNAME='wayang_demo_007'
GROUP_MEMBER_USERNAME_1='wayang_demo_008'
GROUP_MEMBER_USERNAME_2='wayang_demo_009'
GROUP_NON_MEMBER_USERNAME_1='wayang_demo_010'
GROUP_NON_MEMBER_USERNAME_2='wayang_demo_011'

ROOM_OWNER_USERNAME='wayang_demo_012'
ROOM_MEMBER_USERNAME_1='wayang_demo_013'
ROOM_MEMBER_USERNAME_2='wayang_demo_014'
ROOM_NON_MEMBER_USERNAME_1='wayang_demo_015'
ROOM_NON_MEMBER_USERNAME_2='wayang_demo_016'
```

The default pool should favor clear roles over aggressive reuse. Reuse can be
allowed later, but the first version should keep contact, chat, group, and
chat-room fixtures isolated enough that one scenario does not accidentally
consume another scenario's target state.

## Fixture Roles

### Primary Account

`PRIMARY_USERNAME` is the main account used by most JMeter plans. It maps to
the JMeter `username` property unless the caller overrides `username`
explicitly.

### Contact Roles

Contact reset should establish:

- `CONTACT_FRIEND_USERNAME` is a friend of the primary account.
- `CONTACT_NON_FRIEND_USERNAME` is not a friend of the primary account.
- `CONTACT_DELETE_USERNAME` is a friend of the primary account before delete
  scenarios run.
- `CONTACT_ADD_USERNAME` is not a friend of the primary account before add
  scenarios run.

This supports read, add, delete, block-list, and remark workflows without
requiring the JMeter plan to create its own account data.

### Chat Roles

ChatManager scenarios already exist and currently rely on manually prepared
contact state. REST fixtures should make that prerequisite explicit:

- `CHAT_PEER_USERNAME` is a friend of the primary account before peer-message
  scenarios run.
- Group-message scenarios can use the active group fixture.
- Chat-room-message scenarios can use the active room fixture.

Message IDs, thread IDs, and other per-run values remain JMeter runtime
variables extracted by the scenario plans.

### Group Roles

Group reset should establish:

- an active group owned by `GROUP_OWNER_USERNAME` or another configured owner;
- `GROUP_MEMBER_USERNAME_1` and `GROUP_MEMBER_USERNAME_2` are active members;
- `GROUP_NON_MEMBER_USERNAME_1` and `GROUP_NON_MEMBER_USERNAME_2` are not
  active members;
- a known destroyed group ID is available when scenarios need a dissolved or
  nonexistent group reference.

The active group ID and destroyed group ID belong in `state.json` and should be
exported to JMeter through generated properties such as `groupId` and
`destroyedGroupId`.

### Chat Room Roles

Chat room reset should establish five roles:

- `ROOM_OWNER_USERNAME`
- `ROOM_MEMBER_USERNAME_1`
- `ROOM_MEMBER_USERNAME_2`
- `ROOM_NON_MEMBER_USERNAME_1`
- `ROOM_NON_MEMBER_USERNAME_2`

The active chat room should include the owner and the two member users.
Non-member users should remain outside the room before join, invite, removal,
or permission scenarios run. The active room ID and any intentionally destroyed
room ID belong in `state.json` and should be exported as JMeter properties such
as `roomId` and `destroyedRoomId` when needed.

## Command Design

### provision-users.sh

Purpose: create or verify the account pool.

Typical usage:

```bash
jmeter/tools/rest_fixtures/provision-users.sh \
  --config jmeter/tools/rest_fixtures/config.env \
  --prefix wayang_demo \
  --count default
```

Behavior:

- Load REST credentials and `appKey`.
- Create missing users with the configured password.
- Treat existing users with the expected names as usable.
- Write `users.env`.
- Exit non-zero if REST credentials are invalid, appKey mapping is invalid, or
  a required user cannot be created or verified.

### reset-fixtures.sh

Purpose: restore server-side relationship and resource state.

Typical usage:

```bash
jmeter/tools/rest_fixtures/reset-fixtures.sh --scenario contact
jmeter/tools/rest_fixtures/reset-fixtures.sh --scenario chat
jmeter/tools/rest_fixtures/reset-fixtures.sh --scenario group
jmeter/tools/rest_fixtures/reset-fixtures.sh --scenario chat-room
jmeter/tools/rest_fixtures/reset-fixtures.sh --all
```

Behavior:

- Source `users.env`.
- Validate the appKey and required role variables.
- For the selected scenario, remove conflicting relationships and create the
  required relationships.
- Create or verify active group and room resources.
- Update `state.json`.
- Write `jmeter-props.sh`.
- Exit non-zero if the requested scenario cannot be made ready.

Reset should be idempotent. Running the same reset command twice should leave
the same observable fixture state.

### destroy-fixtures.sh

Purpose: clean generated relationship resources.

Typical usage:

```bash
jmeter/tools/rest_fixtures/destroy-fixtures.sh --scenario group
jmeter/tools/rest_fixtures/destroy-fixtures.sh --all
```

Behavior:

- Delete or dissolve generated groups and chat rooms when safe.
- Remove generated contact relationships when requested.
- Preserve users by default.
- Require an explicit dangerous option, such as `--delete-users --yes`, before
  deleting the account pool.

Account deletion should remain a rare maintenance operation because frequent
create/delete cycles make the environment slower and less stable.

### run-scenario.sh

Purpose: run one JMeter plan or scenario group.

Typical usage:

```bash
jmeter/tools/rest_fixtures/run-scenario.sh contact
jmeter/tools/rest_fixtures/run-scenario.sh group
jmeter/tools/rest_fixtures/run-scenario.sh chat-manager/message-send-types
jmeter/tools/rest_fixtures/run-scenario.sh --no-reset chat-manager/message-query
```

Behavior:

- Map the scenario name to a `.jmx` path.
- Reset the matching fixture by default.
- Source `jmeter-props.sh`.
- Run JMeter CLI with generated `JMETER_PROPS`.
- Write `.jtl` and `.log` files under a runtime log directory.
- Return JMeter's exit code.

`--no-reset` is only for local debugging. CI and normal regression runs should
reset fixtures before each scenario.

### run-suite.sh

Purpose: orchestrate multiple scenario runs.

Typical usage:

```bash
jmeter/tools/rest_fixtures/run-suite.sh --all
jmeter/tools/rest_fixtures/run-suite.sh contact chat group chat-room
```

Behavior:

- Expand selected suite names into scenario names.
- Call `run-scenario.sh` for each scenario.
- Stop on first failure by default.
- Optionally support `--continue-on-failure` later.

`run-suite.sh` should not duplicate JMeter CLI construction. It should delegate
to `run-scenario.sh` so single-scenario and suite behavior remain consistent.

## Scenario Mapping

The first implementation can keep a Bash `case` mapping instead of adding a
new config language.

Initial examples:

```text
contact                       -> jmeter/data/rn-sdk-contact-manager.jmx
group                         -> jmeter/data/rn-sdk-group-manager.jmx
chat-room                     -> jmeter/data/rn-sdk-chat-room-manager.jmx
chat-manager/message-query    -> jmeter/data/chat-manager/message-query.jmx
chat-manager/message-send-types
                              -> jmeter/data/chat-manager/message-send-types.jmx
```

The mapping should also declare which fixture reset is needed:

```text
contact                       -> reset contact
group                         -> reset group
chat-room                     -> reset chat-room
chat-manager/message-send-types
                              -> reset chat
chat-manager/message-target-types
                              -> reset chat,group,chat-room
chat-manager/message-thread-management
                              -> reset chat,group
```

Other chat-manager scenarios should declare the smallest fixture set they need.
Peer-only message scenarios can reset only `chat`; group message or thread
scenarios should include `group`; room message scenarios should include
`chat-room`. The reset selection belongs in the runner mapping, not in the
`.jmx` files.

## JMeter Property Handoff

The selected design is JMeter properties as the handoff format. Existing
`.jmx` files already use variables such as `${url}`, `${port}`, `${topic}`,
`${appKey}`, `${username}`, `${password}`, and `${contactUserId}`. The runner
should pass those values with `-J` arguments.

`jmeter-props.sh` should define a Bash array:

```bash
JMETER_PROPS=(
  -Jurl='localhost'
  -Jport='8083'
  -Jtimeout='10000'
  -Jtopic='rn'
  -JappKey='1135220126133718#demo'
  -Jusername='wayang_demo_001'
  -Jpassword='qwerty'
  -JcontactUserId='wayang_demo_002'
  -JcontactNonFriendUserId='wayang_demo_003'
  -JgroupId='123456789'
  -JdestroyedGroupId='987654321'
  -JroomId='456789123'
)
```

The runner should execute JMeter in the same style as the current manual CLI
flow:

```bash
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t "$jmx_file" \
  -l "$jtl_file" \
  -j "$log_file" \
  "${JMETER_PROPS[@]}" \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

The generated properties should use the variable names already present in
existing plans where possible. Additional properties may be generated for
future scenarios, but they should not require changing current `.jmx` files in
this phase.

## State File

`state.json` stores dynamic server resources that are not account roles:

```json
{
  "appKey": "1135220126133718#demo",
  "prefix": "wayang_demo",
  "group": {
    "activeGroupId": "123456789",
    "destroyedGroupId": "987654321"
  },
  "chatRoom": {
    "activeRoomId": "456789123",
    "destroyedRoomId": "321987654"
  },
  "updatedAt": "2026-06-18T00:00:00Z"
}
```

The state file is for fixture scripts, not for JMeter. JMeter receives selected
values from `jmeter-props.sh`.

## Error Handling

Fixture scripts should use strict shell behavior and clear failure messages:

- missing `curl` or `jq` should fail before any REST mutation;
- missing REST credentials should fail before any live REST mutation;
- appKey mismatch between config and `users.env` should fail;
- failed REST calls should print the operation name, HTTP status, and response
  body;
- reset failure should stop before JMeter runs;
- runner failure should return the failing JMeter process status.

REST operations should be written as idempotent helpers where practical. For
example, "ensure friend" should tolerate the users already being friends, and
"ensure non-member" should tolerate the user already being outside the group or
room.

## Security And Git Hygiene

- Commit scripts and example config files.
- Do not commit real `config.env`, `users.env`, `state.json`,
  `jmeter-props.sh`, `.jtl`, or JMeter logs.
- Do not pass `restAppToken` to JMeter.
- Avoid printing `restAppToken` in logs.
- Prefer explicit prefixes for generated accounts so dangerous cleanup can be
  scoped to known fixture users.
- Require explicit confirmation for account deletion.

## Testing Strategy

Script-level checks:

- shell syntax checks for all `.sh` files;
- unit-style tests for scenario-to-JMX mapping if the mapping grows;
- dry-run mode for printing intended REST operations without calling live REST
  APIs;
- validation that generated `jmeter-props.sh` is sourceable by Bash.

Verification should run in two phases. Phase 1 validates script flow without
real REST credentials. It must pass before Phase 2 is attempted:

1. Run `provision-users.sh --dry-run` with example or dummy non-secret config.
2. Confirm `users.env` has all required roles and no real token.
3. Run `reset-fixtures.sh --scenario contact --dry-run`.
4. Confirm `jmeter-props.sh` contains expected `-J` values and no REST token.
5. Run `run-scenario.sh --dry-run contact`.
6. Run `run-suite.sh --dry-run contact chat-manager/message-send-types`.

Phase 2 uses a disposable appKey and real REST credentials supplied by the
caller immediately before execution:

1. Run `provision-users.sh` against the disposable appKey.
2. Run `reset-fixtures.sh --scenario contact`.
3. Run `run-scenario.sh contact`.
4. Run one chat-manager scenario that needs a contact, such as
   `chat-manager/message-send-types`.
5. Run `run-suite.sh contact chat-manager/message-send-types`.

CI can start with script validation and a dry run. Full REST mutation tests
should require explicit environment credentials and should not run on arbitrary
pull requests.

## Open Implementation Notes

- The implementation should confirm each concrete group, chat room, contact,
  member, and destroy endpoint against the Easemob server-side documentation
  before adding the REST call.
- If an API exposes eventual consistency, reset helpers may need small bounded
  retries before failing.
- If a specific JMeter plan uses a different variable name than the generated
  default, prefer adding an alias property in `jmeter-props.sh` over editing
  the `.jmx` file in this phase.
- If later scenario specs require more roles, extend `users.env` with new
  named roles rather than repurposing existing roles silently.
