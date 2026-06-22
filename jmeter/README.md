# JMeter

JMeter test plans and related configuration for driving `measured_app` through
`forward_server`.

- Required JMeter version: Apache JMeter 5.6.3.
- Test plans live in `data/`.
- This document is organized around two workflows: data preparation and test
  execution.

## Data Preparation

`jmeter/data-fixtures/` is an independent Node.js helper package for preparing
Easemob REST API data used by tests. It manages only:

- fixed fixture accounts;
- contact relationships;
- one group;
- one chat room.

It does not modify `.jmx` files, does not adapt existing JMeter variable names,
and does not prepare conversation data.

### Configure REST Access

Create the local config file:

```sh
cd jmeter/data-fixtures
yarn prepare
```

`yarn prepare` copies `config.example.cjs` to `config.local.cjs`. Edit
`config.local.cjs` and fill in the REST app token and fixture prefix:

- `restHost`
- `restOrgName`
- `restAppName`
- `restAppToken`
- `userPrefix`
- `defaultPassword`

`config.local.cjs` is ignored by git.

### Prepare Accounts

Fixture accounts are persistent. They do not need to be recreated before every
test run.

```sh
cd jmeter/data-fixtures
yarn prepare:accounts
```

### Reset Relationships

Reset relationships before running tests that depend on contacts, groups, or
chat rooms.

```sh
cd jmeter/data-fixtures
yarn reset:relationships
```

The reset creates one public group for GroupManager scenarios and one chat room
for ChatRoomManager scenarios. The REST group create request sends
`membersonly:false` and `invite_need_confirm:false`, so the fixture group is
public and does not require approval for direct joins or invited members. The
fixture chat room is owned by `ROOM_OWNER_USERNAME` and includes
`ROOM_MEMBER_USERNAME_1` and `ROOM_MEMBER_USERNAME_2`.

### Delete Accounts

Delete fixture accounts and any recorded group/chat room state:

```sh
cd jmeter/data-fixtures
yarn delete:accounts
```

### Data Outputs

Generated runtime files are ignored by git:

```text
jmeter/data-fixtures/.state/accounts.env
jmeter/data-fixtures/.state/relationships.env
jmeter/data-fixtures/.state/logs/
```

The `.env` files contain only flat key-value data. Execution details and REST
errors are written to timestamped log files under `.state/logs/`.

## Test Case Generation

This step is optional. It is only needed when scenario definitions or shared
helpers change.

The ChatManager scenario plans under `jmeter/data/chat-manager/` are generated
files. Do not edit those `.jmx` files directly; direct edits will be overwritten
the next time the generator runs. Change scenario definitions or shared helpers
under `jmeter/tools/chat_manager_scenarios/`, then regenerate:

```sh
node jmeter/tools/chat_manager_scenarios/generate.js
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

The ContactManager scenario plans under `jmeter/data/contact-manager/` are also
generated files. They consume fixture state from
`jmeter/data-fixtures/.state/accounts.env` and
`jmeter/data-fixtures/.state/relationships.env`, so run
`yarn prepare:accounts` and `yarn reset:relationships` from
`jmeter/data-fixtures/` before executing them. Rerun `reset:relationships` to
restore the supported baseline before rerunning a mutating scenario or the full
suite. Regenerate them with:

```sh
node jmeter/tools/contact_manager_scenarios/generate.js
node --test jmeter/tools/contact_manager_scenarios/generate.test.js
```

The GroupManager scenario plans under `jmeter/data/group-manager/` are also
generated files. They consume the fixture group and group users from
`jmeter/data-fixtures/.state/relationships.env`, log in as the fixture group
owner by default, and may mutate fixture group state. Rerun
`yarn reset:relationships` to restore the supported baseline before rerunning a
mutating scenario or the full suite. Regenerate them with:

```sh
node jmeter/tools/group_manager_scenarios/generate.js
node --test jmeter/tools/group_manager_scenarios/generate.test.js
```

The ChatRoomManager scenario plans under `jmeter/data/chat-room-manager/` are
also generated files. They consume the fixture chat room and room users from
`jmeter/data-fixtures/.state/relationships.env`, log in as the fixture room
owner by default, and may mutate fixture room state. Rerun
`yarn reset:relationships` to restore the supported baseline before rerunning a
mutating scenario or the full suite. Regenerate them with:

```sh
node jmeter/tools/chat_room_manager_scenarios/generate.js
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
```

The ChatUserInfoManager scenario plans under
`jmeter/data/user-info-manager/` are also generated files. They consume fixture
accounts from `jmeter/data-fixtures/.state/accounts.env`, verify the prepared
relationship marker from `jmeter/data-fixtures/.state/relationships.env`, and
log in as the primary fixture account by default. Regenerate them with:

```sh
node jmeter/tools/user_info_manager_scenarios/generate.js
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

## Test Case Execution

Prerequisites:

- `forward_server` is running and listening on `localhost:8083`.
- `measured_app` is running, has connected to the relay, and is ready to receive commands.
- Apache JMeter 5.6.3 is installed at `/Applications/apache-jmeter-5.6.3`.

### Execute All Test Plans

Run both top-level coverage plans and nested scenario plans:

```sh
rm -rf /tmp/rn-wayang-jmeter-all
mkdir -p /tmp/rn-wayang-jmeter-all
find jmeter/data -name '*.jmx' -print | sort | while read -r f; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JappKey="${APP_KEY:-1135220126133718#demo}" \
    -Jusername="${CHAT_USERNAME:-asterisk001}" \
    -Jpassword="${CHAT_PASSWORD:-qwerty}" \
    -l "/tmp/rn-wayang-jmeter-all/${name}.jtl" \
    -j "/tmp/rn-wayang-jmeter-all/${name}.log" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

### Execute Top-Level Test Plans

Run one top-level test plan and save full XML results, response data, and
sampler data:

```sh
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-chat-client.jmx \
  -l /tmp/rn-sdk-chat-client.jtl \
  -j /tmp/rn-sdk-chat-client.log \
  -Jurl="${JMETER_URL:-localhost}" \
  -Jport="${JMETER_PORT:-8083}" \
  -Jtimeout="${JMETER_TIMEOUT:-10000}" \
  -Jtopic="${JMETER_TOPIC:-rn}" \
  -JappKey="${APP_KEY:-1135220126133718#demo}" \
  -Jusername="${CHAT_USERNAME:-asterisk001}" \
  -Jpassword="${CHAT_PASSWORD:-qwerty}" \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Run all current top-level test plans one by one:

```sh
rm -rf /tmp/*.jtl /tmp/*.log
for f in jmeter/data/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/${name}.jtl" \
    -j "/tmp/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JappKey="${APP_KEY:-1135220126133718#demo}" \
    -Jusername="${CHAT_USERNAME:-asterisk001}" \
    -Jpassword="${CHAT_PASSWORD:-qwerty}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

### Execute Scenario Test Plans

Run all ChatManager scenario plans under `jmeter/data/chat-manager/`:

```sh
rm -rf /tmp/rn-wayang-chat-manager-scenarios
mkdir -p /tmp/rn-wayang-chat-manager-scenarios
for f in jmeter/data/chat-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-chat-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-chat-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JappKey="${APP_KEY:-1135220126133718#demo}" \
    -Jusername="${CHAT_USERNAME:-asterisk001}" \
    -Jpassword="${CHAT_PASSWORD:-qwerty}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

Run all ContactManager scenario plans under `jmeter/data/contact-manager/`:

```sh
rm -rf /tmp/rn-wayang-contact-manager-scenarios
mkdir -p /tmp/rn-wayang-contact-manager-scenarios
for f in jmeter/data/contact-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-contact-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-contact-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${CONTACT_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${CONTACT_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

Run all GroupManager scenario plans under `jmeter/data/group-manager/`:

```sh
rm -rf /tmp/rn-wayang-group-manager-scenarios
mkdir -p /tmp/rn-wayang-group-manager-scenarios
for f in jmeter/data/group-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-group-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-group-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -JfileTimeout="${JMETER_FILE_TIMEOUT:-60000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${GROUP_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${GROUP_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

Run all ChatRoomManager scenario plans under `jmeter/data/chat-room-manager/`:

```sh
rm -rf /tmp/rn-wayang-chat-room-manager-scenarios
mkdir -p /tmp/rn-wayang-chat-room-manager-scenarios
for f in jmeter/data/chat-room-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-chat-room-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-chat-room-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${ROOM_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${ROOM_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

Run all ChatUserInfoManager scenario plans under
`jmeter/data/user-info-manager/`:

```sh
rm -rf /tmp/rn-wayang-user-info-manager-scenarios
mkdir -p /tmp/rn-wayang-user-info-manager-scenarios
for f in jmeter/data/user-info-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-user-info-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-user-info-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${USER_INFO_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${USER_INFO_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

### Check Results

Check for failed samples in the generated JTL files:

```sh
rg -n 's="false"|<failure>true' \
  /tmp/rn-sdk-*.jtl \
  /tmp/rn-wayang-chat-manager-scenarios/*.jtl \
  /tmp/rn-wayang-contact-manager-scenarios/*.jtl \
  /tmp/rn-wayang-group-manager-scenarios/*.jtl \
  /tmp/rn-wayang-chat-room-manager-scenarios/*.jtl \
  /tmp/rn-wayang-user-info-manager-scenarios/*.jtl \
  /tmp/rn-wayang-jmeter-all/*.jtl
```

If the command prints no matches and each JMeter summary reports `Err: 0
(0.00%)`, the active samplers passed. Disabled samplers are not executed by
these commands.

When a generated JTL file has failed samples, inspect both the sample label and
the response body. The top-level response shape `{ok:true,value:...}` only means
the request reached a measured app wrapper; SDK or business errors can still be
carried inside `value`. For example:

- `rc="SDK_ERROR"` with a `ChatError` value means the SDK returned an error.
- `rc="PRECONDITION_FAILED"` means a scenario could not discover or derive a required value such as a contact, group, room, thread, or message id.
- `WebSocket I/O error` usually points to relay/app connectivity or an overly short timeout.

## ChatManager Scenario Notes

The generated ChatManager scenario plans under `jmeter/data/chat-manager/` are
end-to-end SDK scenarios. They do not only verify that the WebSocket protocol
works; they also exercise Agora Chat server capabilities through `measured_app`.

Before running them, prepare the test account configured in the JMX variables:

- `appKey`, `username`, and `password` must be valid for the same Agora Chat app.
- The user must have at least one contact. The scenarios discover `contactUserId` from `ChatContactManager.getAllContactsFromServer`.
- The user must have at least one joined group. Group and thread scenarios discover `groupId` from `ChatGroupManager.getJoinedGroups`.
- The app should have at least one public chat room available. Room target scenarios discover `roomId` from `ChatRoomManager.fetchPublicChatRoomsFromServer`.
- The app must allow sending to the discovered contact, group, and room from the configured user.

Some scenarios require optional Agora Chat services to be enabled for the appKey:

- `message-reaction.jmx` requires the reaction service. If it is not enabled, `ChatManager.addReaction` returns an SDK error such as `code=505` and `this appKey is not open reaction service!`.
- `message-translation.jmx` requires translation support. If it is unavailable, `ChatManager.fetchSupportedLanguages` or `ChatManager.translateMessage` can return SDK server errors.
- `message-thread-management.jmx` and the thread part of `message-target-types.jmx` require chat thread support. If it is not enabled, `ChatManager.createChatThread` returns an SDK error such as `code=305` and `thread not open.`.

These capability errors are real test failures, not JMeter parser failures. Do
not whitelist them as passing unless the current test objective is explicitly to
skip unavailable services.

### Runtime Variables

The ChatManager scenario plans keep UI-friendly defaults in `User Defined
Variables`, and the main runtime values can be overridden from CLI with JMeter
properties:

- `url` defaults to `localhost`.
- `port` defaults to `8083`.
- `timeout` defaults to `10000`.
- `topic` defaults to `rn`.
- `appKey` defaults to `1135220126133718#demo`.
- `username` defaults to `asterisk001`.
- `password` defaults to `qwerty`.

`url` and `port` target `forward_server`. `topic` must match the topic used by
`measured_app`; by default `measured_app/src/RNWS.ts` connects with topic `rn`.

Pass overrides with `-J`:

```sh
-Jurl="$JMETER_URL" \
-Jport="$JMETER_PORT" \
-Jtimeout="$JMETER_TIMEOUT" \
-Jtopic="$JMETER_TOPIC" \
-JappKey="$APP_KEY" \
-Jusername="$CHAT_USERNAME" \
-Jpassword="$CHAT_PASSWORD"
```

Shell environment variables are not read automatically by the JMX files; map
them to JMeter properties with `-J` as shown above. In JMeter UI, the same values
can still be edited in `User Defined Variables`.

Other scenario values such as `contactUserId`, `conversationId`, `messageId`,
`groupId`, `roomId`, `threadId`, and `cursor` are runtime test variables. They
are discovered or overwritten by earlier samplers during an ordered run, so do
not run dependent middle samplers in isolation unless you have manually prepared
the required variables.
