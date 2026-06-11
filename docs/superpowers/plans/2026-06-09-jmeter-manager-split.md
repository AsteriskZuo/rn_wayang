# JMeter Manager Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three independently runnable JMeter manager plans with a shared base flow and a few starter sample cases.

**Architecture:** Use `jmeter/data/rn-sdk-base.jmx` as the only XML template. Each new manager `.jmx` duplicates the same connect/init/login/logout flow and inserts two low-risk manager-specific samplers before logout. Historical JMeter files are not referenced.

**Tech Stack:** JMeter 5.6.3 `.jmx` XML, Luminis WebSocket Samplers (`eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler`), measured_app WebSocket command protocol, `/Applications/apache-jmeter-5.6.3/bin/jmeter`.

---

## File Structure

- Create: `jmeter/data/rn-sdk-chat-client.jmx`
  - Independent client manager plan.
  - Sample commands: `ChatClient.getCurrentUsername`, `ChatClient.isLoginBefore`.
- Create: `jmeter/data/rn-sdk-chat-manager.jmx`
  - Independent chat manager plan.
  - Sample commands: `ChatManager.fetchSupportedLanguages`, `ChatManager.getAllConversations`.
- Create: `jmeter/data/rn-sdk-group-manager.jmx`
  - Independent group manager plan.
  - Sample commands: `ChatGroupManager.getJoinedGroups`, `ChatGroupManager.fetchJoinedGroupCount`.
- Read only: `jmeter/data/rn-sdk-base.jmx`
  - Format and shared-flow template only.
- Read only: `measured_app/src/Dispatch.ts`
  - Verify command names remain wired.
- Read only: `measured_app/src/biz/BizChatClient.ts`
  - Verify client sample command wrappers.
- Read only: `measured_app/src/biz/BizChatManager.ts`
  - Verify chat manager sample command wrappers.
- Read only: `measured_app/src/biz/BizChatGroupManager.ts`
  - Verify group manager sample command wrappers.

Do not read or restore deleted historical JMeter files. Do not create the future merge tool.

## Shared XML Rules

All three new files must preserve the `rn-sdk-base.jmx` structure:

- Header: `<?xml version="1.0" encoding="UTF-8"?>`
- Root: `<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">`
- Top-level `TestPlan`, `Arguments`, `ThreadGroup`, sampler, and listener shape.
- Every test element must have the matching sibling `<hashTree/>` or `<hashTree>...</hashTree>`.
- Shared sampler order must be:
  1. `建立连接`
  2. `初始化`
  3. `登录（正常）`
  4. Two manager sample samplers
  5. `登出`
  6. `View Results Tree`
  7. `Summary Report`

Use these common parameters exactly as in `rn-sdk-base.jmx`:

- `url = localhost`
- `port = 8083`
- `topic = rn`
- `appKey = easemob-demo#unitytest`
- `username = tst02`
- `password = 1`

## Task 1: Verify The Template And Command Surface

**Files:**
- Read: `jmeter/data/rn-sdk-base.jmx`
- Read: `measured_app/src/Dispatch.ts`
- Read: `measured_app/src/biz/BizChatClient.ts`
- Read: `measured_app/src/biz/BizChatManager.ts`
- Read: `measured_app/src/biz/BizChatGroupManager.ts`

- [ ] **Step 1: Confirm only the base JMeter file exists**

Run:

```bash
rg --files jmeter/data
```

Expected output includes only:

```text
jmeter/data/rn-sdk-base.jmx
```

- [ ] **Step 2: Confirm the six sample commands are dispatched**

Run:

```bash
rg -n "case '(ChatClient.getCurrentUsername|ChatClient.isLoginBefore|ChatManager.fetchSupportedLanguages|ChatManager.getAllConversations|ChatGroupManager.getJoinedGroups|ChatGroupManager.fetchJoinedGroupCount)'" measured_app/src/dispatch/*.generated.ts
```

Expected output includes all six commands:

```text
case 'ChatClient.getCurrentUsername'
case 'ChatClient.isLoginBefore'
case 'ChatManager.fetchSupportedLanguages'
case 'ChatManager.getAllConversations'
case 'ChatGroupManager.getJoinedGroups'
case 'ChatGroupManager.fetchJoinedGroupCount'
```

- [ ] **Step 3: Confirm the six wrapper methods exist**

Run:

```bash
rg -n "static (getCurrentUsername|isLoginBefore|fetchSupportedLanguages|getAllConversations|getJoinedGroups|fetchJoinedGroupCount)" measured_app/src/biz/BizChatClient.ts measured_app/src/biz/BizChatManager.ts measured_app/src/biz/BizChatGroupManager.ts
```

Expected output maps commands to these files:

```text
BizChatClient.ts: getCurrentUsername
BizChatClient.ts: isLoginBefore
BizChatManager.ts: fetchSupportedLanguages
BizChatManager.ts: getAllConversations
BizChatGroupManager.ts: getJoinedGroups
BizChatGroupManager.ts: fetchJoinedGroupCount
```

## Task 2: Create `rn-sdk-chat-client.jmx`

**Files:**
- Create: `jmeter/data/rn-sdk-chat-client.jmx`

- [ ] **Step 1: Copy the base JMeter XML shape**

Create `jmeter/data/rn-sdk-chat-client.jmx` from `jmeter/data/rn-sdk-base.jmx`.

Set the `ThreadGroup` `testname` to:

```xml
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="ChatClient 用例" enabled="true">
```

- [ ] **Step 2: Remove disabled fragment placeholders**

Delete these placeholder controllers and their sibling hash trees from the copied file:

```xml
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="联系人管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="群组管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="会话列表管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="会话管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="用户信息管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="订阅管理" enabled="false"/>
<hashTree/>
```

- [ ] **Step 3: Insert the `ChatClient.getCurrentUsername` sampler before logout**

Insert this sampler and hash tree immediately before the `登出` sampler:

```xml
        <eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="获取当前用户名" enabled="true">
          <boolProp name="createNewConnection">false</boolProp>
          <boolProp name="TLS">false</boolProp>
          <stringProp name="server"></stringProp>
          <stringProp name="port">80</stringProp>
          <stringProp name="path"></stringProp>
          <boolProp name="binaryPayload">false</boolProp>
          <stringProp name="requestData">{
	&quot;type&quot;: 1,
	&quot;objId&quot;: 10000,
	&quot;cmd&quot;: &quot;ChatClient.getCurrentUsername&quot;,
	&quot;device&quot;: &quot;${topic}&quot;,
	&quot;sequence&quot;: 1,
	&quot;info&quot;: {}
}</stringProp>
          <boolProp name="loadDataFromFile">false</boolProp>
          <stringProp name="dataFile"></stringProp>
        </eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree/>
```

- [ ] **Step 4: Insert the `ChatClient.isLoginBefore` sampler before logout**

Insert this sampler and hash tree after `获取当前用户名` and before `登出`:

```xml
        <eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="获取登录状态" enabled="true">
          <boolProp name="createNewConnection">false</boolProp>
          <boolProp name="TLS">false</boolProp>
          <stringProp name="server"></stringProp>
          <stringProp name="port">80</stringProp>
          <stringProp name="path"></stringProp>
          <boolProp name="binaryPayload">false</boolProp>
          <stringProp name="requestData">{
	&quot;type&quot;: 1,
	&quot;objId&quot;: 10000,
	&quot;cmd&quot;: &quot;ChatClient.isLoginBefore&quot;,
	&quot;device&quot;: &quot;${topic}&quot;,
	&quot;sequence&quot;: 1,
	&quot;info&quot;: {}
}</stringProp>
          <boolProp name="loadDataFromFile">false</boolProp>
          <stringProp name="dataFile"></stringProp>
        </eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree/>
```

- [ ] **Step 5: Verify the file contains the expected sampler order**

Run:

```bash
rg -n "testname=\"(建立连接|初始化|登录（正常）|获取当前用户名|获取登录状态|登出|View Results Tree|Summary Report)\"" jmeter/data/rn-sdk-chat-client.jmx
```

Expected order:

```text
建立连接
初始化
登录（正常）
获取当前用户名
获取登录状态
登出
View Results Tree
Summary Report
```

## Task 3: Create `rn-sdk-chat-manager.jmx`

**Files:**
- Create: `jmeter/data/rn-sdk-chat-manager.jmx`

- [ ] **Step 1: Copy the base JMeter XML shape**

Create `jmeter/data/rn-sdk-chat-manager.jmx` from `jmeter/data/rn-sdk-base.jmx`.

Set the `ThreadGroup` `testname` to:

```xml
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="ChatManager 用例" enabled="true">
```

- [ ] **Step 2: Remove disabled fragment placeholders**

Delete these placeholder controllers and their sibling hash trees from the copied file:

```xml
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="联系人管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="群组管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="会话列表管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="会话管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="用户信息管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="订阅管理" enabled="false"/>
<hashTree/>
```

- [ ] **Step 3: Insert the `ChatManager.fetchSupportedLanguages` sampler before logout**

Insert this sampler and hash tree immediately before the `登出` sampler:

```xml
        <eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="获取翻译支持语言" enabled="true">
          <boolProp name="createNewConnection">false</boolProp>
          <boolProp name="TLS">false</boolProp>
          <stringProp name="server"></stringProp>
          <stringProp name="port">80</stringProp>
          <stringProp name="path"></stringProp>
          <boolProp name="binaryPayload">false</boolProp>
          <stringProp name="requestData">{
	&quot;type&quot;: 1,
	&quot;objId&quot;: 10000,
	&quot;cmd&quot;: &quot;ChatManager.fetchSupportedLanguages&quot;,
	&quot;device&quot;: &quot;${topic}&quot;,
	&quot;sequence&quot;: 1,
	&quot;info&quot;: {}
}</stringProp>
          <boolProp name="loadDataFromFile">false</boolProp>
          <stringProp name="dataFile"></stringProp>
        </eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree/>
```

- [ ] **Step 4: Insert the `ChatManager.getAllConversations` sampler before logout**

Insert this sampler and hash tree after `获取翻译支持语言` and before `登出`:

```xml
        <eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="加载全部会话" enabled="true">
          <boolProp name="createNewConnection">false</boolProp>
          <boolProp name="TLS">false</boolProp>
          <stringProp name="server"></stringProp>
          <stringProp name="port">80</stringProp>
          <stringProp name="path"></stringProp>
          <boolProp name="binaryPayload">false</boolProp>
          <stringProp name="requestData">{
	&quot;type&quot;: 1,
	&quot;objId&quot;: 10000,
	&quot;cmd&quot;: &quot;ChatManager.getAllConversations&quot;,
	&quot;device&quot;: &quot;${topic}&quot;,
	&quot;sequence&quot;: 1,
	&quot;info&quot;: {}
}</stringProp>
          <boolProp name="loadDataFromFile">false</boolProp>
          <stringProp name="dataFile"></stringProp>
        </eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree/>
```

- [ ] **Step 5: Verify the file contains the expected sampler order**

Run:

```bash
rg -n "testname=\"(建立连接|初始化|登录（正常）|获取翻译支持语言|加载全部会话|登出|View Results Tree|Summary Report)\"" jmeter/data/rn-sdk-chat-manager.jmx
```

Expected order:

```text
建立连接
初始化
登录（正常）
获取翻译支持语言
加载全部会话
登出
View Results Tree
Summary Report
```

## Task 4: Create `rn-sdk-group-manager.jmx`

**Files:**
- Create: `jmeter/data/rn-sdk-group-manager.jmx`

- [ ] **Step 1: Copy the base JMeter XML shape**

Create `jmeter/data/rn-sdk-group-manager.jmx` from `jmeter/data/rn-sdk-base.jmx`.

Set the `ThreadGroup` `testname` to:

```xml
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="GroupManager 用例" enabled="true">
```

- [ ] **Step 2: Remove disabled fragment placeholders**

Delete these placeholder controllers and their sibling hash trees from the copied file:

```xml
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="联系人管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="群组管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="会话列表管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="会话管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="用户信息管理" enabled="false"/>
<hashTree/>
<TestFragmentController guiclass="TestFragmentControllerGui" testclass="TestFragmentController" testname="订阅管理" enabled="false"/>
<hashTree/>
```

- [ ] **Step 3: Insert the `ChatGroupManager.getJoinedGroups` sampler before logout**

Insert this sampler and hash tree immediately before the `登出` sampler:

```xml
        <eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="获取已加入群组" enabled="true">
          <boolProp name="createNewConnection">false</boolProp>
          <boolProp name="TLS">false</boolProp>
          <stringProp name="server"></stringProp>
          <stringProp name="port">80</stringProp>
          <stringProp name="path"></stringProp>
          <boolProp name="binaryPayload">false</boolProp>
          <stringProp name="requestData">{
	&quot;type&quot;: 1,
	&quot;objId&quot;: 10000,
	&quot;cmd&quot;: &quot;ChatGroupManager.getJoinedGroups&quot;,
	&quot;device&quot;: &quot;${topic}&quot;,
	&quot;sequence&quot;: 1,
	&quot;info&quot;: {}
}</stringProp>
          <boolProp name="loadDataFromFile">false</boolProp>
          <stringProp name="dataFile"></stringProp>
        </eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree/>
```

- [ ] **Step 4: Insert the `ChatGroupManager.fetchJoinedGroupCount` sampler before logout**

Insert this sampler and hash tree after `获取已加入群组` and before `登出`:

```xml
        <eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="获取已加入群组数量" enabled="true">
          <boolProp name="createNewConnection">false</boolProp>
          <boolProp name="TLS">false</boolProp>
          <stringProp name="server"></stringProp>
          <stringProp name="port">80</stringProp>
          <stringProp name="path"></stringProp>
          <boolProp name="binaryPayload">false</boolProp>
          <stringProp name="requestData">{
	&quot;type&quot;: 1,
	&quot;objId&quot;: 10000,
	&quot;cmd&quot;: &quot;ChatGroupManager.fetchJoinedGroupCount&quot;,
	&quot;device&quot;: &quot;${topic}&quot;,
	&quot;sequence&quot;: 1,
	&quot;info&quot;: {}
}</stringProp>
          <boolProp name="loadDataFromFile">false</boolProp>
          <stringProp name="dataFile"></stringProp>
        </eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree/>
```

- [ ] **Step 5: Verify the file contains the expected sampler order**

Run:

```bash
rg -n "testname=\"(建立连接|初始化|登录（正常）|获取已加入群组|获取已加入群组数量|登出|View Results Tree|Summary Report)\"" jmeter/data/rn-sdk-group-manager.jmx
```

Expected order:

```text
建立连接
初始化
登录（正常）
获取已加入群组
获取已加入群组数量
登出
View Results Tree
Summary Report
```

## Task 5: Static Verification

**Files:**
- Verify: `jmeter/data/rn-sdk-chat-client.jmx`
- Verify: `jmeter/data/rn-sdk-chat-manager.jmx`
- Verify: `jmeter/data/rn-sdk-group-manager.jmx`

- [ ] **Step 1: Confirm only the expected JMeter files exist**

Run:

```bash
rg --files jmeter/data
```

Expected output includes exactly:

```text
jmeter/data/rn-sdk-base.jmx
jmeter/data/rn-sdk-chat-client.jmx
jmeter/data/rn-sdk-chat-manager.jmx
jmeter/data/rn-sdk-group-manager.jmx
```

- [ ] **Step 2: Validate XML well-formedness**

Run:

```bash
xmllint --noout jmeter/data/rn-sdk-chat-client.jmx jmeter/data/rn-sdk-chat-manager.jmx jmeter/data/rn-sdk-group-manager.jmx
```

Expected: command exits `0` with no output.

- [ ] **Step 3: Confirm there are no disabled fragment placeholders**

Run:

```bash
rg -n "TestFragmentController|联系人管理|群组管理|会话列表管理|会话管理|用户信息管理|订阅管理" jmeter/data/rn-sdk-chat-client.jmx jmeter/data/rn-sdk-chat-manager.jmx jmeter/data/rn-sdk-group-manager.jmx
```

Expected: no matches.

- [ ] **Step 4: Confirm each manager file contains exactly six WebSocket samplers**

Run:

```bash
for f in jmeter/data/rn-sdk-chat-client.jmx jmeter/data/rn-sdk-chat-manager.jmx jmeter/data/rn-sdk-group-manager.jmx; do printf "%s " "$f"; rg -c "RequestResponseWebSocketSampler guiclass" "$f"; done
```

Expected output:

```text
jmeter/data/rn-sdk-chat-client.jmx 6
jmeter/data/rn-sdk-chat-manager.jmx 6
jmeter/data/rn-sdk-group-manager.jmx 6
```

- [ ] **Step 5: Confirm each manager file contains the expected command JSON**

Run:

```bash
rg -n "&quot;cmd&quot;: &quot;(ChatClient.init|ChatClient.login|ChatClient.logout|ChatClient.getCurrentUsername|ChatClient.isLoginBefore|ChatManager.fetchSupportedLanguages|ChatManager.getAllConversations|ChatGroupManager.getJoinedGroups|ChatGroupManager.fetchJoinedGroupCount)&quot;" jmeter/data/rn-sdk-chat-client.jmx jmeter/data/rn-sdk-chat-manager.jmx jmeter/data/rn-sdk-group-manager.jmx
```

Expected:

- Every file has `ChatClient.init`, `ChatClient.login`, and `ChatClient.logout`.
- `rn-sdk-chat-client.jmx` has `ChatClient.getCurrentUsername` and `ChatClient.isLoginBefore`.
- `rn-sdk-chat-manager.jmx` has `ChatManager.fetchSupportedLanguages` and `ChatManager.getAllConversations`.
- `rn-sdk-group-manager.jmx` has `ChatGroupManager.getJoinedGroups` and `ChatGroupManager.fetchJoinedGroupCount`.

## Task 6: JMeter CLI Verification

**Files:**
- Verify: `jmeter/data/rn-sdk-chat-client.jmx`
- Verify: `jmeter/data/rn-sdk-chat-manager.jmx`
- Verify: `jmeter/data/rn-sdk-group-manager.jmx`

Prerequisites:

- `forward_server` is running on `localhost:8083`.
- measured_app is connected to `topic=rn`.
- measured_app START has registered `Dispatch`.
- No stale JMeter UI or CLI driver connection is using `topic=rn`.

- [ ] **Step 1: Run `rn-sdk-chat-client.jmx` with fresh output files**

Run:

```bash
rm -f /tmp/rn-sdk-chat-client.jtl /tmp/rn-sdk-chat-client.log
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-chat-client.jmx \
  -l /tmp/rn-sdk-chat-client.jtl \
  -j /tmp/rn-sdk-chat-client.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Expected console summary contains:

```text
Err:     0 (0.00%)
```

- [ ] **Step 2: Inspect `rn-sdk-chat-client.jtl`**

Run:

```bash
sed -n '1,120p' /tmp/rn-sdk-chat-client.jtl
```

Expected output contains six successful sample entries for:

```text
建立连接
初始化
登录（正常）
获取当前用户名
获取登录状态
登出
```

Expected output also contains request data from `samplerData` and response data from `responseData`.

- [ ] **Step 3: Run `rn-sdk-chat-manager.jmx` with fresh output files**

Run:

```bash
rm -f /tmp/rn-sdk-chat-manager.jtl /tmp/rn-sdk-chat-manager.log
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-chat-manager.jmx \
  -l /tmp/rn-sdk-chat-manager.jtl \
  -j /tmp/rn-sdk-chat-manager.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Expected console summary contains:

```text
Err:     0 (0.00%)
```

- [ ] **Step 4: Inspect `rn-sdk-chat-manager.jtl`**

Run:

```bash
sed -n '1,120p' /tmp/rn-sdk-chat-manager.jtl
```

Expected output contains six successful sample entries for:

```text
建立连接
初始化
登录（正常）
获取翻译支持语言
加载全部会话
登出
```

Expected output also contains request data from `samplerData` and response data from `responseData`.

- [ ] **Step 5: Run `rn-sdk-group-manager.jmx` with fresh output files**

Run:

```bash
rm -f /tmp/rn-sdk-group-manager.jtl /tmp/rn-sdk-group-manager.log
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-group-manager.jmx \
  -l /tmp/rn-sdk-group-manager.jtl \
  -j /tmp/rn-sdk-group-manager.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Expected console summary contains:

```text
Err:     0 (0.00%)
```

- [ ] **Step 6: Inspect `rn-sdk-group-manager.jtl`**

Run:

```bash
sed -n '1,120p' /tmp/rn-sdk-group-manager.jtl
```

Expected output contains six successful sample entries for:

```text
建立连接
初始化
登录（正常）
获取已加入群组
获取已加入群组数量
登出
```

Expected output also contains request data from `samplerData` and response data from `responseData`.

- [ ] **Step 7: If a CLI run times out, verify stale initiator behavior before editing XML**

Check the `forward_server` log. If the CLI connection sends messages to a previous JMeter connection instead of the measured_app connection, close the stale driver connection or restart `forward_server`, then rerun the same JMeter command with new `/tmp/*.jtl` and `/tmp/*.log` paths.

Do not change the `.jmx` until the stale-connection hypothesis has been ruled out.

## Task 7: Final Review And Single Commit

**Files:**
- Commit: `jmeter/data/rn-sdk-chat-client.jmx`
- Commit: `jmeter/data/rn-sdk-chat-manager.jmx`
- Commit: `jmeter/data/rn-sdk-group-manager.jmx`

- [ ] **Step 1: Review the diff**

Run:

```bash
git diff -- jmeter/data/rn-sdk-chat-client.jmx jmeter/data/rn-sdk-chat-manager.jmx jmeter/data/rn-sdk-group-manager.jmx
```

Expected:

- Three new `.jmx` files.
- No modifications to `rn-sdk-base.jmx`.
- No references to deleted historical `.jmx` files.

- [ ] **Step 2: Run whitespace diff check**

Run:

```bash
git diff --check
```

Expected: command exits `0` with no output.

- [ ] **Step 3: Confirm working tree contains only intended files**

Run:

```bash
git status --short
```

Expected output:

```text
?? jmeter/data/rn-sdk-chat-client.jmx
?? jmeter/data/rn-sdk-chat-manager.jmx
?? jmeter/data/rn-sdk-group-manager.jmx
```

If unrelated user changes are present, leave them unstaged.

- [ ] **Step 4: Commit once**

Run:

```bash
git add jmeter/data/rn-sdk-chat-client.jmx jmeter/data/rn-sdk-chat-manager.jmx jmeter/data/rn-sdk-group-manager.jmx
git commit -m "test: add jmeter manager sample plans"
```

Expected commit includes only the three new manager `.jmx` files.
