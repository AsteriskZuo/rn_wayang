# JMeter Positive API Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add positive JMeter coverage for all generated `measured_app` Chat SDK manager routes, with a verified `"ok":true` assertion pattern and documented default, conditional, and limited coverage APIs.

**Architecture:** JMX files are hand-edited by manager and remain independently runnable. Implementation starts with a small `rn-sdk-chat-client.jmx` assertion pilot and stops for user UI verification before broad rollout. The full rollout expands eight manager plans, declares all JMeter variables in each plan, and records coverage limits in `docs/jmeter-api-coverage.md`.

**Tech Stack:** Apache JMeter 5.6.3 `.jmx` XML, Luminis WebSocket Sampler, measured_app WebSocket command protocol, React Native Chat SDK generated dispatch routes.

---

## Source Spec

Read this before executing any task:

- `docs/superpowers/specs/2026-06-12-jmeter-positive-api-coverage-design.md`

Stop and ask the user if implementation uncovers a need to change the approved design.

## File Structure

Modify existing JMeter plans:

- `jmeter/data/rn-sdk-base.jmx`
  - Base template/reference plan.
  - Normalize structure by removing standalone `建立连接`.
- `jmeter/data/rn-sdk-chat-client.jmx`
  - Assertion pilot file.
  - Full positive coverage for `ChatClient`.
- `jmeter/data/rn-sdk-chat-manager.jmx`
  - Full positive coverage for `ChatManager`.
- `jmeter/data/rn-sdk-group-manager.jmx`
  - Full positive coverage for `ChatGroupManager`.

Create new JMeter plans:

- `jmeter/data/rn-sdk-chat-room-manager.jmx`
  - Full positive coverage for `ChatRoomManager`.
- `jmeter/data/rn-sdk-contact-manager.jmx`
  - Full positive coverage for `ChatContactManager`.
- `jmeter/data/rn-sdk-presence-manager.jmx`
  - Full positive coverage for `ChatPresenceManager`.
- `jmeter/data/rn-sdk-push-manager.jmx`
  - Full positive coverage for `ChatPushManager`.
- `jmeter/data/rn-sdk-user-info-manager.jmx`
  - Full positive coverage for `ChatUserInfoManager`.

Create or update documentation:

- `docs/jmeter-api-coverage.md`
  - Manager-to-JMX mapping.
  - JMeter variable glossary.
  - Positive-only rule.
  - Limited-coverage API list and reasons.
  - SDK upgrade notes.

Implementation references:

- `jmeter/data/rn-sdk-base.jmx`
  - Normalize first, then use as XML structure reference.
- `measured_app/src/dispatch/*.generated.ts`
  - Authoritative generated route list.
- `measured_app/src/biz/Biz*.ts`
  - Authoritative payload shape reference for each `info` object.
- `measured_app/src/dispatch/Response.ts`
  - Confirms successful protocol response is wrapped as `{ok:true,value:...}`.

## Shared XML Templates

Use this response assertion as the child hash tree content for every positive API sampler. No JMX file should include a standalone `建立连接` sampler, including `jmeter/data/rn-sdk-base.jmx`.

```xml
        <hashTree>
          <ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="断言业务成功 ok=true" enabled="true">
            <collectionProp name="Asserion.test_strings">
              <stringProp name="358647012">&quot;ok&quot;:true</stringProp>
            </collectionProp>
            <stringProp name="Assertion.custom_message">response body must contain &quot;ok&quot;:true</stringProp>
            <stringProp name="Assertion.test_field">Assertion.response_data</stringProp>
            <boolProp name="Assertion.assume_success">false</boolProp>
            <intProp name="Assertion.test_type">2</intProp>
          </ResponseAssertion>
          <hashTree/>
        </hashTree>
```

For each WebSocket API sampler, the sibling `<hashTree/>` currently used by starter files becomes the `<hashTree>...</hashTree>` above.

For every JMX file, the first command sampler is normally `初始化`. It must open the WebSocket connection directly with this property shape:

```xml
        <eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="初始化" enabled="true">
          <boolProp name="createNewConnection">true</boolProp>
          <boolProp name="TLS">false</boolProp>
          <stringProp name="server">${url}</stringProp>
          <stringProp name="port">${port}</stringProp>
          <stringProp name="path">/iov/websocket/dual?topic=${topic}</stringProp>
          <stringProp name="connectTimeout">${timeout}</stringProp>
          <boolProp name="binaryPayload">false</boolProp>
          <stringProp name="requestData">{
	&quot;type&quot;: 1,
	&quot;objId&quot;: 10000,
	&quot;cmd&quot;: &quot;ChatClient.init&quot;,
	&quot;device&quot;: &quot;${topic}&quot;,
	&quot;sequence&quot;: 1,
	&quot;info&quot;: {&quot;appKey&quot;:&quot;easemob-demo#unitytest&quot;,&quot;autoLogin&quot;:false,&quot;debugModel&quot;:true}
}</stringProp>
          <stringProp name="readTimeout">${timeout}</stringProp>
          <boolProp name="loadDataFromFile">false</boolProp>
          <stringProp name="dataFile"></stringProp>
        </eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
```

Attach the `"ok":true` assertion hash tree to this `初始化` sampler.

Use this request JSON shape for command samplers:

```json
{
  "type": 1,
  "objId": 10000,
  "cmd": "Manager.methodName",
  "device": "${topic}",
  "sequence": 1,
  "info": {}
}
```

When adding JSON to `.jmx`, escape quotes as `&quot;` inside `<stringProp name="requestData">`.

Coverage classes:

- Default runnable positive samplers are enabled by default.
- Conditional positive samplers exist for route coverage but are disabled by
  default when they require special tokens, unique accounts, destructive device
  actions, app identity changes, RTC setup, or other environment-sensitive
  values.
- Limited coverage samplers must be documented when `"ok":true` does not prove
  the full SDK/business behavior.

When a sampler interpolates a JMeter variable inside a JSON string, the variable
value must be JSON-safe: no unescaped double quotes, backslashes, or newlines.
Variables intended to represent JSON objects must be inserted as raw JSON
objects, not quoted strings.

## Task 1: Baseline Inventory And Guardrails

**Files:**
- Read: `docs/superpowers/specs/2026-06-12-jmeter-positive-api-coverage-design.md`
- Read: `measured_app/src/dispatch/*.generated.ts`
- Read: `measured_app/src/biz/Biz*.ts`
- Read: `jmeter/data/*.jmx`

- [ ] **Step 1: Confirm the worktree is clean**

Run:

```bash
git status --short
```

Expected output:

```text
```

If output is not empty, inspect the changes. Do not overwrite user changes.

- [ ] **Step 2: Count generated routes**

Run:

```bash
rg "case 'Chat" measured_app/src/dispatch/*.generated.ts | wc -l
```

Expected output at the time this plan was written:

```text
     223
```

If the count differs, continue only after checking whether generated routes changed since the plan was written.

- [ ] **Step 3: Capture route list by manager for local reference**

Run:

```bash
rg "case 'Chat" measured_app/src/dispatch/*.generated.ts
```

Expected: route lines for these eight generated dispatch files:

```text
ChatClient.generated.ts
ChatManager.generated.ts
ChatGroupManager.generated.ts
ChatRoomManager.generated.ts
ChatContactManager.generated.ts
ChatPresenceManager.generated.ts
ChatPushManager.generated.ts
ChatUserInfoManager.generated.ts
```

- [ ] **Step 4: Confirm successful response wrapper**

Run:

```bash
sed -n '1,120p' measured_app/src/dispatch/Response.ts
```

Expected: `wrapApiCallback` returns callback payloads shaped as `{ok: true, value: normalizeApiValue(value)}`.

- [ ] **Step 5: Commit checkpoint if any inventory-only notes were created**

Do not create inventory files in this task. If an executor created temporary local notes, remove them before proceeding.

## Task 2: Add And Verify The Assertion Pilot

**Files:**
- Modify: `jmeter/data/rn-sdk-chat-client.jmx`
- Read: `jmeter/data/rn-sdk-chat-client.jmx`

- [ ] **Step 1: Delete the standalone connection sampler**

In `jmeter/data/rn-sdk-chat-client.jmx`, delete the standalone sampler with this test name and its sibling hash tree:

```text
建立连接
```

Do not edit `jmeter/data/rn-sdk-base.jmx` during the assertion pilot. It is normalized in Task 3 after the user approves the pilot.

- [ ] **Step 2: Move WebSocket connection settings onto 初始化**

In the `初始化` sampler in `jmeter/data/rn-sdk-chat-client.jmx`, set these properties:

```xml
<boolProp name="createNewConnection">true</boolProp>
<stringProp name="server">${url}</stringProp>
<stringProp name="port">${port}</stringProp>
<stringProp name="path">/iov/websocket/dual?topic=${topic}</stringProp>
<stringProp name="connectTimeout">${timeout}</stringProp>
<stringProp name="readTimeout">${timeout}</stringProp>
```

Keep the existing `ChatClient.init` request body.

- [ ] **Step 3: Add the response assertion to existing ChatClient command samplers**

In `jmeter/data/rn-sdk-chat-client.jmx`, replace each sibling `<hashTree/>` after these samplers with the shared response assertion hash tree:

```text
初始化
登录（正常）
获取当前用户名
获取登录状态
登出
```

- [ ] **Step 4: Confirm no standalone connection sampler remains**

Run:

```bash
rg -n "testname=\"建立连接\"" jmeter/data/rn-sdk-chat-client.jmx
```

Expected: no output.

- [ ] **Step 5: Confirm assertion count**

Run:

```bash
rg -n "断言业务成功 ok=true|&quot;ok&quot;:true" jmeter/data/rn-sdk-chat-client.jmx
```

Expected: five assertion blocks and five `&quot;ok&quot;:true` strings.

- [ ] **Step 6: Confirm XML is well formed**

Run:

```bash
xmllint --noout jmeter/data/rn-sdk-chat-client.jmx
```

Expected: exit code `0` and no output.

- [ ] **Step 7: Run normal pilot if local JMeter and measured app are available**

Before running, ensure:

- `forward_server` is running on `localhost:8083`.
- `measured_app` is connected to topic `rn`.
- No stale JMeter/UI driver is already the initiator for topic `rn`.

Run:

```bash
rm -f /tmp/rn-sdk-chat-client-pilot.jtl /tmp/rn-sdk-chat-client-pilot.log
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-chat-client.jmx \
  -l /tmp/rn-sdk-chat-client-pilot.jtl \
  -j /tmp/rn-sdk-chat-client-pilot.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Expected: command exits `0`; JMeter summary shows no sampler failures.

- [ ] **Step 8: Create a temporary failing copy**

Run:

```bash
cp jmeter/data/rn-sdk-chat-client.jmx /tmp/rn-sdk-chat-client-pilot-fail.jmx
perl -0pi -e 's/ChatClient\.getCurrentUsername/ChatClient.invalidPilotCommand/' /tmp/rn-sdk-chat-client-pilot-fail.jmx
xmllint --noout /tmp/rn-sdk-chat-client-pilot-fail.jmx
```

Expected: `xmllint` exits `0`.

- [ ] **Step 9: Run the temporary failing copy if local JMeter and measured app are available**

Run:

```bash
rm -f /tmp/rn-sdk-chat-client-pilot-fail.jtl /tmp/rn-sdk-chat-client-pilot-fail.log
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t /tmp/rn-sdk-chat-client-pilot-fail.jmx \
  -l /tmp/rn-sdk-chat-client-pilot-fail.jtl \
  -j /tmp/rn-sdk-chat-client-pilot-fail.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Expected: the sampler with `ChatClient.invalidPilotCommand` fails because the response does not contain `"ok":true`.

- [ ] **Step 10: Remove temporary failing copy outputs**

Run:

```bash
rm -f /tmp/rn-sdk-chat-client-pilot-fail.jmx /tmp/rn-sdk-chat-client-pilot-fail.jtl /tmp/rn-sdk-chat-client-pilot-fail.log
```

Expected: files are removed from `/tmp`.

- [ ] **Step 11: Stop for user manual verification**

Ask the user to open `jmeter/data/rn-sdk-chat-client.jmx` in JMeter UI and verify:

- Normal calls show green when responses contain `"ok":true`.
- A controlled invalid command shows red when the response is a protocol error.
- The JMeter tree remains readable.

Do not proceed to Task 3 until the user explicitly approves the assertion pilot.

- [ ] **Step 12: Commit the assertion pilot after user approval**

Run:

```bash
git status --short
git add jmeter/data/rn-sdk-chat-client.jmx
git commit -m "test: add jmeter success assertion pilot"
```

Expected: one commit containing only the pilot JMX change.

## Task 3: Normalize Existing JMX Structure

**Files:**
- Modify: `jmeter/data/rn-sdk-base.jmx`
- Modify: `jmeter/data/rn-sdk-chat-manager.jmx`
- Modify: `jmeter/data/rn-sdk-group-manager.jmx`
- Read: `jmeter/data/rn-sdk-chat-client.jmx`

- [ ] **Step 1: Remove standalone connection samplers from existing non-pilot files**

In each file, delete the standalone sampler named `建立连接` and its sibling hash tree:

```text
jmeter/data/rn-sdk-base.jmx
jmeter/data/rn-sdk-chat-manager.jmx
jmeter/data/rn-sdk-group-manager.jmx
```

Use `jmeter/data/rn-sdk-chat-client.jmx` after the assertion pilot as the structural reference.

- [ ] **Step 2: Move WebSocket connection settings onto 初始化**

In each file's `初始化` sampler, set:

```xml
<boolProp name="createNewConnection">true</boolProp>
<stringProp name="server">${url}</stringProp>
<stringProp name="port">${port}</stringProp>
<stringProp name="path">/iov/websocket/dual?topic=${topic}</stringProp>
<stringProp name="connectTimeout">${timeout}</stringProp>
<stringProp name="readTimeout">${timeout}</stringProp>
```

Keep each existing `ChatClient.init` request body.

- [ ] **Step 3: Add the success assertion to existing command samplers**

Attach the shared `"ok":true` response assertion hash tree to every existing command sampler in these files:

```text
jmeter/data/rn-sdk-base.jmx
jmeter/data/rn-sdk-chat-manager.jmx
jmeter/data/rn-sdk-group-manager.jmx
```

- [ ] **Step 4: Confirm the four existing files share the same connection pattern**

Run:

```bash
rg -n "testname=\"建立连接\"" \
  jmeter/data/rn-sdk-base.jmx \
  jmeter/data/rn-sdk-chat-client.jmx \
  jmeter/data/rn-sdk-chat-manager.jmx \
  jmeter/data/rn-sdk-group-manager.jmx
```

Expected: no output.

Run:

```bash
rg -n "testname=\"初始化\"|createNewConnection|/iov/websocket/dual\\?topic=\\$\\{topic\\}" \
  jmeter/data/rn-sdk-base.jmx \
  jmeter/data/rn-sdk-chat-client.jmx \
  jmeter/data/rn-sdk-chat-manager.jmx \
  jmeter/data/rn-sdk-group-manager.jmx
```

Expected: each file has `初始化`, `createNewConnection>true`, and `/iov/websocket/dual?topic=${topic}` in the `初始化` sampler.

- [ ] **Step 5: Confirm XML is well formed**

Run:

```bash
xmllint --noout \
  jmeter/data/rn-sdk-base.jmx \
  jmeter/data/rn-sdk-chat-client.jmx \
  jmeter/data/rn-sdk-chat-manager.jmx \
  jmeter/data/rn-sdk-group-manager.jmx
```

Expected: exit code `0` and no output.

- [ ] **Step 6: Commit normalized existing files**

Run:

```bash
git add \
  jmeter/data/rn-sdk-base.jmx \
  jmeter/data/rn-sdk-chat-manager.jmx \
  jmeter/data/rn-sdk-group-manager.jmx
git commit -m "test: normalize existing jmeter connection flow"
```

Expected: one commit containing the base, chat manager, and group manager JMX structure updates.

## Task 4: Create The Coverage Documentation Skeleton

**Files:**
- Create: `docs/jmeter-api-coverage.md`

- [ ] **Step 1: Create the coverage document**

Create `docs/jmeter-api-coverage.md` with these sections:

```markdown
# JMeter API Coverage

## Scope

This document tracks positive JMeter coverage for the measured app generated Chat SDK routes.

Coverage means the JMeter sampler sends a valid command through `forward_server`, `measured_app` dispatches it to the matching Biz wrapper, and the response body contains `"ok":true`.

Negative cases are not covered in this pass.

## Manager Plans

| Manager | JMX File | Status |
| --- | --- | --- |
| Base template | `jmeter/data/rn-sdk-base.jmx` | Normalized reference flow |
| ChatClient | `jmeter/data/rn-sdk-chat-client.jmx` | Default and conditional positive coverage |
| ChatManager | `jmeter/data/rn-sdk-chat-manager.jmx` | Default, conditional, and limited positive coverage |
| ChatGroupManager | `jmeter/data/rn-sdk-group-manager.jmx` | Default, conditional, and limited positive coverage |
| ChatRoomManager | `jmeter/data/rn-sdk-chat-room-manager.jmx` | Default and conditional positive coverage |
| ChatContactManager | `jmeter/data/rn-sdk-contact-manager.jmx` | Default and limited positive coverage |
| ChatPresenceManager | `jmeter/data/rn-sdk-presence-manager.jmx` | Default positive coverage |
| ChatPushManager | `jmeter/data/rn-sdk-push-manager.jmx` | Default and conditional positive coverage |
| ChatUserInfoManager | `jmeter/data/rn-sdk-user-info-manager.jmx` | Default positive coverage |

## Variable Rules

Every business input used by a sampler is declared in that JMX file's User Defined Variables section.

If future manual maintenance adds a sampler and forgets to declare a variable, that is a future test-maintenance issue. This pass does not add runtime guards for missing variables.

String variable values used inside request JSON must be JSON-safe. Do not put raw
double quotes, backslashes, or newlines into JMeter variables unless the value is
already correctly escaped for JSON.

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
```

- [ ] **Step 2: Confirm document renders as expected**

Run:

```bash
sed -n '1,220p' docs/jmeter-api-coverage.md
```

Expected: the document contains the sections shown in Step 1.

- [ ] **Step 3: Commit coverage document skeleton**

Run:

```bash
git add docs/jmeter-api-coverage.md
git commit -m "docs: add jmeter api coverage notes"
```

Expected: one docs commit.

## Task 5: Build The Manual Route Payload Inventory

**Files:**
- Read: `measured_app/src/dispatch/*.generated.ts`
- Read: `measured_app/src/biz/Biz*.ts`
- Modified by implementation tasks: `jmeter/data/*.jmx`
- Modified by implementation tasks: `docs/jmeter-api-coverage.md`

- [ ] **Step 1: Inventory ChatClient routes**

Run:

```bash
rg "case 'ChatClient\." measured_app/src/dispatch/ChatClient.generated.ts
```

For each route, open `measured_app/src/biz/BizChatClient.ts` and identify the `info` fields destructured or read by the wrapper. Use JMeter variables for business values.

- [ ] **Step 2: Inventory ChatContactManager routes**

Run:

```bash
rg "case 'ChatContactManager\." measured_app/src/dispatch/ChatContactManager.generated.ts
```

For each route, open `measured_app/src/biz/BizChatContactManager.ts` and identify the `info` fields destructured or read by the wrapper. Mark APIs like `addContact` as limited coverage when the immediate response cannot prove final business state.

- [ ] **Step 3: Inventory ChatUserInfoManager routes**

Run:

```bash
rg "case 'ChatUserInfoManager\." measured_app/src/dispatch/ChatUserInfoManager.generated.ts
```

For each route, open `measured_app/src/biz/BizChatUserInfoManager.ts` and identify the `info` fields destructured or read by the wrapper. Use variables for user IDs and profile values.

- [ ] **Step 4: Inventory ChatPresenceManager routes**

Run:

```bash
rg "case 'ChatPresenceManager\." measured_app/src/dispatch/ChatPresenceManager.generated.ts
```

For each route, open `measured_app/src/biz/BizChatPresenceManager.ts` and identify the `info` fields destructured or read by the wrapper. Use variables for member lists and expiry values.

- [ ] **Step 5: Inventory ChatPushManager routes**

Run:

```bash
rg "case 'ChatPushManager\." measured_app/src/dispatch/ChatPushManager.generated.ts
```

For each route, open `measured_app/src/biz/BizChatPushManager.ts` and identify the `info` fields destructured or read by the wrapper. Use variables for conversation IDs, template names, language, and nickname.

- [ ] **Step 6: Inventory ChatRoomManager routes**

Run:

```bash
rg "case 'ChatRoomManager\." measured_app/src/dispatch/ChatRoomManager.generated.ts
```

For each route, open `measured_app/src/biz/BizChatRoomManager.ts` and identify the `info` fields destructured or read by the wrapper. Use variables for room IDs, members, announcement text, attributes, and owner/admin IDs.

- [ ] **Step 7: Inventory ChatGroupManager routes**

Run:

```bash
rg "case 'ChatGroupManager\." measured_app/src/dispatch/ChatGroupManager.generated.ts
```

For each route, open `measured_app/src/biz/BizChatGroupManager.ts` and identify the `info` fields destructured or read by the wrapper. Use variables for group IDs, members, file paths, announcement text, attributes, and owner/admin IDs.

- [ ] **Step 8: Inventory ChatManager routes**

Run:

```bash
rg "case 'ChatManager\." measured_app/src/dispatch/ChatManager.generated.ts
```

For each route, open `measured_app/src/biz/BizChatManager.ts` and identify the `info` fields destructured or read by the wrapper. Use variables for conversation IDs, message IDs, message payload fields, thread IDs, timestamps, keywords, reactions, marks, and local file paths.

- [ ] **Step 9: Stop on any route without a reasonable positive payload**

If any API cannot be given a reasonable positive payload without changing measured_app behavior, stop and ask the user. Do not remove the API from coverage silently.

## Task 6: Expand ChatClient Coverage

**Files:**
- Modify: `jmeter/data/rn-sdk-chat-client.jmx`
- Modify: `docs/jmeter-api-coverage.md`
- Read: `measured_app/src/dispatch/ChatClient.generated.ts`
- Read: `measured_app/src/biz/BizChatClient.ts`

- [ ] **Step 1: Add User Defined Variables needed by ChatClient**

In `jmeter/data/rn-sdk-chat-client.jmx`, declare every variable used by ChatClient samplers in the existing `User Defined Variables` section. Keep existing variables and add client-specific variables such as:

```text
token
agoraToken
newAppKey
newAppId
deviceResource
channelName
rtcUidList
pushConfigDeviceToken
```

Use empty strings for values that must be supplied by the tester's environment.

- [ ] **Step 2: Add one positive sampler for each ChatClient route**

For every route from `ChatClient.generated.ts`, add or update one sampler in `rn-sdk-chat-client.jmx`.

Use route names exactly as generated, including:

```text
ChatClient.init
ChatClient.isConnected
ChatClient.getCurrentUsername
ChatClient.isLoginBefore
ChatClient.getAccessToken
ChatClient.createAccount
ChatClient.loginWithToken
ChatClient.renewAgoraToken
ChatClient.logout
ChatClient.changeAppKey
ChatClient.changeAppId
ChatClient.compressLogs
ChatClient.getLoggedInDevicesFromServer
ChatClient.kickDevice
ChatClient.kickAllDevices
ChatClient.updatePushConfig
ChatClient.getRTCTokenInfoWithChannelName
ChatClient.getUserIdsWithRTCUids
ChatClient.login
```

Attach the `"ok":true` response assertion to each command sampler. Do not re-add a standalone `建立连接` sampler.

These ChatClient samplers must be marked conditional and disabled by default
because they are destructive, state-resetting, or strongly environment-dependent:

```text
ChatClient.createAccount
ChatClient.loginWithToken
ChatClient.renewAgoraToken
ChatClient.changeAppKey
ChatClient.changeAppId
ChatClient.kickDevice
ChatClient.kickAllDevices
ChatClient.updatePushConfig
ChatClient.getRTCTokenInfoWithChannelName
ChatClient.getUserIdsWithRTCUids
```

Keep the sampler XML present with its assertion, but set `enabled="false"` on
the WebSocket sampler. Do not count disabled conditional samplers as part of the
default one-click runnable flow. Document this distinction in
`docs/jmeter-api-coverage.md`.

- [ ] **Step 3: Validate ChatClient XML and route coverage**

Run:

```bash
xmllint --noout jmeter/data/rn-sdk-chat-client.jmx
rg "case 'ChatClient\." measured_app/src/dispatch/ChatClient.generated.ts | wc -l
rg "&quot;cmd&quot;: &quot;ChatClient\." jmeter/data/rn-sdk-chat-client.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-chat-client.jmx | wc -l
```

Expected: XML is well formed. The command count in JMX is at least the generated route count plus shared setup/teardown commands if repeated.

Also confirm the conditional ChatClient samplers listed in Step 2 are disabled by
default and still have assertions.

- [ ] **Step 4: Update coverage notes for ChatClient**

In `docs/jmeter-api-coverage.md`, add ChatClient-specific variables and limited coverage notes discovered during implementation.

- [ ] **Step 5: Commit ChatClient coverage**

Run:

```bash
git add jmeter/data/rn-sdk-chat-client.jmx docs/jmeter-api-coverage.md
git commit -m "test: expand jmeter chat client coverage"
```

Expected: one commit with ChatClient JMX and documentation updates.

## Task 7: Add Smaller Manager Plans

**Files:**
- Create: `jmeter/data/rn-sdk-contact-manager.jmx`
- Create: `jmeter/data/rn-sdk-presence-manager.jmx`
- Create: `jmeter/data/rn-sdk-push-manager.jmx`
- Create: `jmeter/data/rn-sdk-user-info-manager.jmx`
- Modify: `docs/jmeter-api-coverage.md`
- Read: matching generated dispatch and Biz files

- [ ] **Step 1: Create each smaller manager JMX from the existing manager template**

Use `jmeter/data/rn-sdk-chat-client.jmx` after the assertion pilot as the structural template.

For each new file:

- Do not include `建立连接`.
- Keep `初始化` as the first sampler and set it to open the WebSocket connection with `createNewConnection=true`.
- Keep `登录（正常）`.
- Replace ChatClient-specific API samplers with that manager's API samplers.
- Keep `登出`.
- Keep `View Results Tree`.
- Keep `Summary Report`.
- Declare all variables used by samplers in that file.

- [ ] **Step 2: Add ChatContactManager positive samplers**

In `jmeter/data/rn-sdk-contact-manager.jmx`, add one positive sampler for each generated `ChatContactManager` route:

```text
ChatContactManager.addContact
ChatContactManager.deleteContact
ChatContactManager.getAllContactsFromServer
ChatContactManager.getAllContactsFromDB
ChatContactManager.addUserToBlockList
ChatContactManager.removeUserFromBlockList
ChatContactManager.getBlockListFromServer
ChatContactManager.getBlockListFromDB
ChatContactManager.acceptInvitation
ChatContactManager.declineInvitation
ChatContactManager.getSelfIdsOnOtherPlatform
ChatContactManager.getAllContacts
ChatContactManager.getContact
ChatContactManager.fetchAllContacts
ChatContactManager.fetchContacts
ChatContactManager.setContactRemark
```

Document `ChatContactManager.addContact` as limited coverage if it only proves the request call resolved.

- [ ] **Step 3: Add ChatUserInfoManager positive samplers**

In `jmeter/data/rn-sdk-user-info-manager.jmx`, add one positive sampler for each generated `ChatUserInfoManager` route:

```text
ChatUserInfoManager.updateOwnUserInfo
ChatUserInfoManager.fetchUserInfoById
ChatUserInfoManager.fetchOwnInfo
```

- [ ] **Step 4: Add ChatPresenceManager positive samplers**

In `jmeter/data/rn-sdk-presence-manager.jmx`, add one positive sampler for each generated `ChatPresenceManager` route:

```text
ChatPresenceManager.publishPresence
ChatPresenceManager.subscribe
ChatPresenceManager.unsubscribe
ChatPresenceManager.fetchSubscribedMembers
ChatPresenceManager.fetchPresenceStatus
```

- [ ] **Step 5: Add ChatPushManager positive samplers**

In `jmeter/data/rn-sdk-push-manager.jmx`, add one positive sampler for each generated `ChatPushManager` route:

```text
ChatPushManager.setSilentModeForConversation
ChatPushManager.removeSilentModeForConversation
ChatPushManager.fetchSilentModeForConversation
ChatPushManager.setSilentModeForAll
ChatPushManager.fetchSilentModeForAll
ChatPushManager.fetchSilentModeForConversations
ChatPushManager.setPreferredNotificationLanguage
ChatPushManager.fetchPreferredNotificationLanguage
ChatPushManager.updatePushNickname
ChatPushManager.updatePushDisplayStyle
ChatPushManager.fetchPushOptionFromServer
ChatPushManager.selectPushTemplate
ChatPushManager.fetchSelectedPushTemplate
```

- [ ] **Step 6: Validate smaller manager XML files**

Run:

```bash
xmllint --noout jmeter/data/rn-sdk-contact-manager.jmx
xmllint --noout jmeter/data/rn-sdk-presence-manager.jmx
xmllint --noout jmeter/data/rn-sdk-push-manager.jmx
xmllint --noout jmeter/data/rn-sdk-user-info-manager.jmx
```

Expected: all commands exit `0` with no output.

- [ ] **Step 7: Validate smaller manager assertion coverage**

Run:

```bash
rg "&quot;cmd&quot;: &quot;ChatContactManager\." jmeter/data/rn-sdk-contact-manager.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-contact-manager.jmx | wc -l
rg "&quot;cmd&quot;: &quot;ChatPresenceManager\." jmeter/data/rn-sdk-presence-manager.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-presence-manager.jmx | wc -l
rg "&quot;cmd&quot;: &quot;ChatPushManager\." jmeter/data/rn-sdk-push-manager.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-push-manager.jmx | wc -l
rg "&quot;cmd&quot;: &quot;ChatUserInfoManager\." jmeter/data/rn-sdk-user-info-manager.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-user-info-manager.jmx | wc -l
```

Expected: every command sampler has a matching assertion. Shared setup and teardown commands may add additional assertions.

- [ ] **Step 8: Update coverage notes for smaller managers**

In `docs/jmeter-api-coverage.md`, add variables and limited coverage notes for contact, presence, push, and user info APIs.

- [ ] **Step 9: Commit smaller manager plans**

Run:

```bash
git add \
  jmeter/data/rn-sdk-contact-manager.jmx \
  jmeter/data/rn-sdk-presence-manager.jmx \
  jmeter/data/rn-sdk-push-manager.jmx \
  jmeter/data/rn-sdk-user-info-manager.jmx \
  docs/jmeter-api-coverage.md
git commit -m "test: add jmeter smaller manager coverage"
```

Expected: one commit containing the four new manager plans and docs updates.

## Task 8: Expand ChatGroupManager Coverage

**Files:**
- Modify: `jmeter/data/rn-sdk-group-manager.jmx`
- Modify: `docs/jmeter-api-coverage.md`
- Read: `measured_app/src/dispatch/ChatGroupManager.generated.ts`
- Read: `measured_app/src/biz/BizChatGroupManager.ts`

- [ ] **Step 1: Add group variables**

In `jmeter/data/rn-sdk-group-manager.jmx`, declare variables used by group samplers, including:

```text
groupId
groupName
groupDescription
groupOwner
groupAdmin
groupMember
groupMemberList
groupInviteReason
groupAnnouncement
groupAvatar
groupExtension
groupFileId
localFilePath
cursor
pageSize
pageNum
memberAttributeKey
memberAttributeValue
```

- [ ] **Step 2: Add one positive sampler for each ChatGroupManager route**

Use `BizChatGroupManager.ts` for `info` payload shapes. Add one positive sampler for each generated route:

```text
ChatGroupManager.getGroupWithId
ChatGroupManager.getJoinedGroups
ChatGroupManager.fetchJoinedGroupsFromServer
ChatGroupManager.fetchPublicGroupsFromServer
ChatGroupManager.createGroupEx
ChatGroupManager.fetchGroupInfoWithoutMembersFromServer
ChatGroupManager.fetchMemberListFromServer
ChatGroupManager.fetchMemberInfoListFromServer
ChatGroupManager.fetchBlockListFromServer
ChatGroupManager.fetchMuteListFromServer
ChatGroupManager.fetchAllowListFromServer
ChatGroupManager.isMemberInAllowListFromServer
ChatGroupManager.fetchGroupFileListFromServer
ChatGroupManager.fetchAnnouncementFromServer
ChatGroupManager.addMembers
ChatGroupManager.inviteUser
ChatGroupManager.removeMembers
ChatGroupManager.blockMembers
ChatGroupManager.unblockMembers
ChatGroupManager.changeGroupName
ChatGroupManager.changeGroupDescription
ChatGroupManager.leaveGroup
ChatGroupManager.destroyGroup
ChatGroupManager.blockGroup
ChatGroupManager.unblockGroup
ChatGroupManager.changeOwner
ChatGroupManager.addAdmin
ChatGroupManager.removeAdmin
ChatGroupManager.muteMembers
ChatGroupManager.unMuteMembers
ChatGroupManager.muteAllMembers
ChatGroupManager.unMuteAllMembers
ChatGroupManager.addAllowList
ChatGroupManager.removeAllowList
ChatGroupManager.uploadGroupSharedFile
ChatGroupManager.downloadGroupSharedFile
ChatGroupManager.removeGroupSharedFile
ChatGroupManager.updateGroupAnnouncement
ChatGroupManager.updateGroupAvatar
ChatGroupManager.updateGroupExtension
ChatGroupManager.joinPublicGroup
ChatGroupManager.requestToJoinPublicGroup
ChatGroupManager.acceptJoinApplication
ChatGroupManager.declineJoinApplication
ChatGroupManager.acceptInvitation
ChatGroupManager.declineInvitation
ChatGroupManager.setMemberAttribute
ChatGroupManager.fetchMemberAttributes
ChatGroupManager.fetchMembersAttributes
ChatGroupManager.fetchJoinedGroupCount
```

Attach the `"ok":true` assertion to every group command sampler.

- [ ] **Step 3: Validate group XML and coverage**

Run:

```bash
xmllint --noout jmeter/data/rn-sdk-group-manager.jmx
rg "case 'ChatGroupManager\." measured_app/src/dispatch/ChatGroupManager.generated.ts | wc -l
rg "&quot;cmd&quot;: &quot;ChatGroupManager\." jmeter/data/rn-sdk-group-manager.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-group-manager.jmx | wc -l
```

Expected: XML is well formed. The group JMX command count matches generated group routes after accounting for shared setup/teardown commands.

- [ ] **Step 4: Update coverage notes for ChatGroupManager**

In `docs/jmeter-api-coverage.md`, record group-specific variables and any limited coverage APIs discovered during payload design.

- [ ] **Step 5: Commit group manager coverage**

Run:

```bash
git add jmeter/data/rn-sdk-group-manager.jmx docs/jmeter-api-coverage.md
git commit -m "test: expand jmeter group manager coverage"
```

Expected: one commit with group JMX and documentation updates.

## Task 9: Add ChatRoomManager Coverage

**Files:**
- Create: `jmeter/data/rn-sdk-chat-room-manager.jmx`
- Modify: `docs/jmeter-api-coverage.md`
- Read: `measured_app/src/dispatch/ChatRoomManager.generated.ts`
- Read: `measured_app/src/biz/BizChatRoomManager.ts`

- [ ] **Step 1: Create room manager JMX from the asserted template**

Create `jmeter/data/rn-sdk-chat-room-manager.jmx` from the asserted ChatClient or GroupManager structure.

Set the thread group name to:

```text
ChatRoomManager 用例
```

- [ ] **Step 2: Add room variables**

Declare room variables in the JMX file, including:

```text
roomId
roomName
roomDescription
roomOwner
roomAdmin
roomMember
roomMemberList
roomAnnouncement
roomAttributeKey
roomAttributeValue
cursor
pageSize
pageNum
```

- [ ] **Step 3: Add one positive sampler for each ChatRoomManager route**

Use `BizChatRoomManager.ts` for `info` payload shapes. Add one positive sampler for each generated route:

```text
ChatRoomManager.joinChatRoomEx
ChatRoomManager.leaveChatRoom
ChatRoomManager.fetchPublicChatRoomsFromServer
ChatRoomManager.fetchChatRoomInfoFromServer
ChatRoomManager.getChatRoomWithId
ChatRoomManager.createChatRoom
ChatRoomManager.destroyChatRoom
ChatRoomManager.changeChatRoomSubject
ChatRoomManager.changeChatRoomDescription
ChatRoomManager.fetchChatRoomMembers
ChatRoomManager.muteChatRoomMembers
ChatRoomManager.unMuteChatRoomMembers
ChatRoomManager.changeOwner
ChatRoomManager.addChatRoomAdmin
ChatRoomManager.removeChatRoomAdmin
ChatRoomManager.fetchChatRoomMuteList
ChatRoomManager.removeChatRoomMembers
ChatRoomManager.blockChatRoomMembers
ChatRoomManager.unBlockChatRoomMembers
ChatRoomManager.fetchChatRoomBlockList
ChatRoomManager.updateChatRoomAnnouncement
ChatRoomManager.fetchChatRoomAnnouncement
ChatRoomManager.fetchChatRoomAllowListFromServer
ChatRoomManager.isMemberInChatRoomAllowList
ChatRoomManager.isMemberInChatRoomMuteList
ChatRoomManager.addMembersToChatRoomAllowList
ChatRoomManager.removeMembersFromChatRoomAllowList
ChatRoomManager.muteAllChatRoomMembers
ChatRoomManager.unMuteAllChatRoomMembers
ChatRoomManager.fetchChatRoomAttributes
ChatRoomManager.addAttributes
ChatRoomManager.removeAttributes
```

Attach the `"ok":true` assertion to every room command sampler.

- [ ] **Step 4: Validate room XML and coverage**

Run:

```bash
xmllint --noout jmeter/data/rn-sdk-chat-room-manager.jmx
rg "case 'ChatRoomManager\." measured_app/src/dispatch/ChatRoomManager.generated.ts | wc -l
rg "&quot;cmd&quot;: &quot;ChatRoomManager\." jmeter/data/rn-sdk-chat-room-manager.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-chat-room-manager.jmx | wc -l
```

Expected: XML is well formed. The room JMX command count matches generated room routes after accounting for shared setup/teardown commands.

- [ ] **Step 5: Update coverage notes for ChatRoomManager**

In `docs/jmeter-api-coverage.md`, record room-specific variables and any limited coverage APIs discovered during payload design.

- [ ] **Step 6: Commit room manager coverage**

Run:

```bash
git add jmeter/data/rn-sdk-chat-room-manager.jmx docs/jmeter-api-coverage.md
git commit -m "test: add jmeter chat room manager coverage"
```

Expected: one commit with room JMX and documentation updates.

## Task 10: Expand ChatManager Coverage

**Files:**
- Modify: `jmeter/data/rn-sdk-chat-manager.jmx`
- Modify: `docs/jmeter-api-coverage.md`
- Read: `measured_app/src/dispatch/ChatManager.generated.ts`
- Read: `measured_app/src/biz/BizChatManager.ts`

- [ ] **Step 1: Add chat variables**

In `jmeter/data/rn-sdk-chat-manager.jmx`, declare variables used by chat samplers, including:

```text
contactUserId
groupId
roomId
conversationId
messageId
messageIdList
threadId
threadName
parentMessageId
keyword
reaction
reportReason
reportTag
timestamp
startTimestamp
endTimestamp
cursor
pageSize
pageNum
localFilePath
remoteUrl
conversationMark
pinOperation
```

- [ ] **Step 2: Add one positive sampler for each ChatManager route**

Use `BizChatManager.ts` for `info` payload shapes. Add one positive sampler for each generated route:

```text
ChatManager.sendMessage
ChatManager.resendMessage
ChatManager.sendMessageReadAck
ChatManager.sendGroupMessageReadAck
ChatManager.sendConversationReadAck
ChatManager.recallMessage
ChatManager.getMessage
ChatManager.getMessagesWithIds
ChatManager.markAllConversationsAsRead
ChatManager.getUnreadCount
ChatManager.insertMessage
ChatManager.updateMessage
ChatManager.importMessages
ChatManager.downloadAttachmentInCombine
ChatManager.downloadThumbnailInCombine
ChatManager.downloadAttachment
ChatManager.downloadThumbnail
ChatManager.fetchHistoryMessagesByOptions
ChatManager.getMsgsWithKeyword
ChatManager.getConvsMsgsWithKeyword
ChatManager.fetchGroupAcks
ChatManager.removeConversationFromServer
ChatManager.getConversation
ChatManager.getAllConversations
ChatManager.deleteConversation
ChatManager.getLatestMessage
ChatManager.getLatestReceivedMessage
ChatManager.getConversationUnreadCount
ChatManager.getConversationMessageCount
ChatManager.markMessageAsRead
ChatManager.markAllMessagesAsRead
ChatManager.updateConversationMessage
ChatManager.deleteMessage
ChatManager.deleteMessagesWithTimestamp
ChatManager.deleteConversationAllMessages
ChatManager.deleteMessagesBeforeTimestamp
ChatManager.getMsgsWithMsgType
ChatManager.getMsgs
ChatManager.getConvMsgsWithKeyword
ChatManager.getMsgWithTimestamp
ChatManager.translateMessage
ChatManager.fetchSupportedLanguages
ChatManager.setConversationExtension
ChatManager.addReaction
ChatManager.removeReaction
ChatManager.fetchReactionList
ChatManager.fetchReactionDetail
ChatManager.reportMessage
ChatManager.getReactionList
ChatManager.groupAckCount
ChatManager.createChatThread
ChatManager.joinChatThread
ChatManager.leaveChatThread
ChatManager.destroyChatThread
ChatManager.updateChatThreadName
ChatManager.removeMemberWithChatThread
ChatManager.fetchMembersWithChatThreadFromServer
ChatManager.fetchJoinedChatThreadFromServer
ChatManager.fetchJoinedChatThreadWithParentFromServer
ChatManager.fetchChatThreadWithParentFromServer
ChatManager.fetchLastMessageWithChatThread
ChatManager.fetchChatThreadFromServer
ChatManager.getMessageThread
ChatManager.getThreadConversation
ChatManager.removeMessagesFromServerWithMsgIds
ChatManager.removeMessagesFromServerWithTimestamp
ChatManager.fetchConversationsFromServerWithCursor
ChatManager.fetchPinnedConversationsFromServerWithCursor
ChatManager.pinConversation
ChatManager.modifyMsgBody
ChatManager.fetchCombineMessageDetail
ChatManager.addRemoteAndLocalConversationsMark
ChatManager.deleteRemoteAndLocalConversationsMark
ChatManager.fetchConversationsByOptions
ChatManager.deleteAllMessageAndConversation
ChatManager.pinMessage
ChatManager.unpinMessage
ChatManager.fetchPinnedMessages
ChatManager.getPinnedMessages
ChatManager.getMessagePinInfo
ChatManager.searchMessages
ChatManager.searchMessagesInConversation
ChatManager.removeMessagesWithTimestamp
ChatManager.getMessageCountWithTimestamp
ChatManager.getMessageCount
```

Attach the `"ok":true` assertion to every chat command sampler.

- [ ] **Step 3: Treat stateful message APIs conservatively**

For APIs requiring existing messages, threads, reactions, pins, or local files, use variables instead of hardcoded IDs and paths. Do not add setup logic that mutates measured app behavior. If a route cannot have a reasonable positive payload with variables, stop and ask the user.

- [ ] **Step 4: Validate chat XML and coverage**

Run:

```bash
xmllint --noout jmeter/data/rn-sdk-chat-manager.jmx
rg "case 'ChatManager\." measured_app/src/dispatch/ChatManager.generated.ts | wc -l
rg "&quot;cmd&quot;: &quot;ChatManager\." jmeter/data/rn-sdk-chat-manager.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-chat-manager.jmx | wc -l
```

Expected: XML is well formed. The chat JMX command count matches generated chat routes after accounting for shared setup/teardown commands.

- [ ] **Step 5: Update coverage notes for ChatManager**

In `docs/jmeter-api-coverage.md`, record chat-specific variables and any limited coverage APIs discovered during payload design.

- [ ] **Step 6: Commit chat manager coverage**

Run:

```bash
git add jmeter/data/rn-sdk-chat-manager.jmx docs/jmeter-api-coverage.md
git commit -m "test: expand jmeter chat manager coverage"
```

Expected: one commit with chat JMX and documentation updates.

## Task 11: Final Cross-Manager Verification

**Files:**
- Read: `jmeter/data/*.jmx`
- Read: `measured_app/src/dispatch/*.generated.ts`
- Read: `docs/jmeter-api-coverage.md`

- [ ] **Step 1: Confirm all JMX files are well formed**

Run:

```bash
xmllint --noout \
  jmeter/data/rn-sdk-base.jmx \
  jmeter/data/rn-sdk-chat-client.jmx \
  jmeter/data/rn-sdk-chat-manager.jmx \
  jmeter/data/rn-sdk-group-manager.jmx \
  jmeter/data/rn-sdk-chat-room-manager.jmx \
  jmeter/data/rn-sdk-contact-manager.jmx \
  jmeter/data/rn-sdk-presence-manager.jmx \
  jmeter/data/rn-sdk-push-manager.jmx \
  jmeter/data/rn-sdk-user-info-manager.jmx
```

Expected: exit code `0` and no output.

- [ ] **Step 2: Confirm no JMX file contains standalone connection samplers**

Run:

```bash
rg -n "testname=\"建立连接\"" \
  jmeter/data/rn-sdk-base.jmx \
  jmeter/data/rn-sdk-chat-client.jmx \
  jmeter/data/rn-sdk-chat-manager.jmx \
  jmeter/data/rn-sdk-group-manager.jmx \
  jmeter/data/rn-sdk-chat-room-manager.jmx \
  jmeter/data/rn-sdk-contact-manager.jmx \
  jmeter/data/rn-sdk-presence-manager.jmx \
  jmeter/data/rn-sdk-push-manager.jmx \
  jmeter/data/rn-sdk-user-info-manager.jmx
```

Expected: no output.

- [ ] **Step 3: Confirm no sampler contains an undeclared variable introduced by this pass**

For each JMX file, compare `${...}` references in sampler request bodies with the file's User Defined Variables section. Every variable used by a sampler must be declared in the same file.

Use this command to list references:

```bash
rg -o '\$\{[A-Za-z0-9_]+\}' jmeter/data/*.jmx | sort -u
```

Expected: every listed variable is declared in the relevant JMX file's `Arguments.arguments`.

- [ ] **Step 4: Confirm generated route count and JMX command coverage**

Run:

```bash
rg "case 'Chat" measured_app/src/dispatch/*.generated.ts | wc -l
rg "&quot;cmd&quot;: &quot;Chat" jmeter/data/rn-sdk-*-manager.jmx jmeter/data/rn-sdk-chat-client.jmx | wc -l
```

Expected: generated route count is covered by manager command samplers, after accounting for repeated shared `ChatClient.init`, `ChatClient.login`, and `ChatClient.logout` commands in each independent manager plan.

- [ ] **Step 5: Confirm every command sampler has assertion coverage**

Run:

```bash
rg "&quot;cmd&quot;: &quot;Chat" jmeter/data/rn-sdk-*-manager.jmx jmeter/data/rn-sdk-chat-client.jmx | wc -l
rg "断言业务成功 ok=true" jmeter/data/rn-sdk-*-manager.jmx jmeter/data/rn-sdk-chat-client.jmx | wc -l
```

Expected: assertion count matches the command sampler count.

- [ ] **Step 6: Run JMeter CLI for files that the local environment can support**

For each runnable plan, run:

```bash
rm -f /tmp/<plan-name>.jtl /tmp/<plan-name>.log
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/<plan-name>.jmx \
  -l /tmp/<plan-name>.jtl \
  -j /tmp/<plan-name>.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Replace `<plan-name>` with the actual file stem, such as `rn-sdk-chat-client`.

Expected: plans with valid environment variables and server state exit `0` and have no assertion failures. If a plan fails because the tester has not supplied required business variables, document that in the final report rather than weakening the test.

- [ ] **Step 7: Review coverage document**

Run:

```bash
sed -n '1,260p' docs/jmeter-api-coverage.md
```

Expected: document lists manager files, common variables, manager-specific variables, limited coverage APIs, and SDK upgrade notes.

- [ ] **Step 8: Final status check**

Run:

```bash
git status --short
```

Expected: no uncommitted changes after the final commit.

If there are uncommitted final verification edits, commit them:

```bash
git add docs/jmeter-api-coverage.md jmeter/data/*.jmx
git commit -m "test: complete jmeter positive api coverage"
```

Expected: final commit contains only JMeter and coverage documentation changes.
