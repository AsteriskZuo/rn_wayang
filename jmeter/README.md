# JMeter

JMeter test plans and related configuration for driving `measured_app` through `forward_server`.

- Required JMeter version: Apache JMeter 5.6.3.
- Test plans live in `data/`.

## ChatManager scenario prerequisites

The generated ChatManager scenario plans under `jmeter/data/chat-manager/` are end-to-end SDK scenarios. They do not only verify that the WebSocket protocol works; they also exercise Agora Chat server capabilities through `measured_app`.

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

These capability errors are real test failures, not JMeter parser failures. Do not whitelist them as passing unless the current test objective is explicitly to skip unavailable services.

## Command-line verification

Prerequisites:

- `forward_server` is running and listening on `localhost:8083`.
- `measured_app` is running, has connected to the relay, and is ready to receive commands.
- Apache JMeter 5.6.3 is installed at `/Applications/apache-jmeter-5.6.3`.

Run one test plan and save full XML results, response data, and sampler data:

```sh
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-chat-client.jmx \
  -l /tmp/rn-sdk-chat-client.jtl \
  -j /tmp/rn-sdk-chat-client.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Run all current test plans one by one:

```sh
for f in jmeter/data/*.jmx; do
  name=$(basename "$f" .jmx)
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/${name}.jtl" \
    -j "/tmp/${name}.log" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

Run all ChatManager scenario plans under `jmeter/data/chat-manager/`:

```sh
rm -rf /tmp/rn-wayang-chat-manager-scenarios
mkdir -p /tmp/rn-wayang-chat-manager-scenarios
for f in jmeter/data/chat-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-chat-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-chat-manager-scenarios/${name}.log" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

Run both top-level coverage plans and nested scenario plans:

```sh
rm -rf /tmp/rn-wayang-jmeter-all
mkdir -p /tmp/rn-wayang-jmeter-all
find jmeter/data -name '*.jmx' -print | sort | while read -r f; do
  name=$(basename "$f" .jmx)
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-jmeter-all/${name}.jtl" \
    -j "/tmp/rn-wayang-jmeter-all/${name}.log" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

The ChatManager scenario plans are generated:

```sh
node jmeter/tools/chat_manager_scenarios/generate.js
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Check for failed samples in the generated JTL files:

```sh
rg -n 's="false"|<failure>true' \
  /tmp/rn-sdk-*.jtl \
  /tmp/rn-wayang-chat-manager-scenarios/*.jtl \
  /tmp/rn-wayang-jmeter-all/*.jtl
```

If the command prints no matches and each JMeter summary reports `Err: 0 (0.00%)`, the active samplers passed. Disabled samplers are not executed by these commands.

When a generated JTL file has failed samples, inspect both the sample label and the response body. The top-level response shape `{ok:true,value:...}` only means the request reached a measured app wrapper; SDK or business errors can still be carried inside `value`. For example:

- `rc="SDK_ERROR"` with a `ChatError` value means the SDK returned an error.
- `rc="PRECONDITION_FAILED"` means a scenario could not discover or derive a required value such as a contact, group, room, thread, or message id.
- `WebSocket I/O error` usually points to relay/app connectivity or an overly short timeout.
