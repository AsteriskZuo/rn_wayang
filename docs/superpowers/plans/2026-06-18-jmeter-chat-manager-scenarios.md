# JMeter Chat Manager Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently runnable ChatManager scenario JMeter plans that create or discover runtime resources, pass dynamic values through stable protocol field names, and verify closed-loop message workflows.

**Architecture:** Add a small checked-in JMX generator for scenario plans so the ten scenario files share one XML structure, assertion pattern, and JSR223 helper library instead of drifting by hand. The generated plans live under `jmeter/data/chat-manager/`, use one normal ordered Thread Group per scenario, and keep init, login, workflow, cleanup, and logout as ordinary samplers. Scenario assertions verify the unified WebSocket wrapper first, then inspect `value` for the SDK/business outcome observed during implementation.

**Tech Stack:** Apache JMeter 5.6.3 `.jmx` XML, Luminis WebSocket Sampler, JSR223 Groovy post-processors/assertions, Node.js generator tests, measured_app WebSocket command protocol, React Native Chat SDK Biz wrappers.

---

## Source Spec

Read this before executing any task:

- `docs/superpowers/specs/2026-06-17-jmeter-chat-manager-scenarios-design.md`

Stop and ask the user before changing scenario semantics, weakening assertions, changing measured app wrapper behavior, or changing the approved failure-classification rules.

The user specifically requested that multiple implementation tasks can be committed together. Do not create a commit after every small task. Commit after a coherent batch is verified, or create one final commit for the whole scenario-suite implementation.

## File Structure

Create implementation support files:

- `jmeter/tools/chat_manager_scenarios/generate.js`
  - Generates all ChatManager scenario `.jmx` files.
  - Owns XML escaping, sampler creation, assertions, JSR223 blocks, and scenario definitions.
  - Uses only Node.js built-ins so it can run without a root `package.json`.
- `jmeter/tools/chat_manager_scenarios/generate.test.js`
  - Node test suite for generator output.
  - Verifies scenario filenames, no setUp/tearDown Thread Groups, stable protocol field names, required assertions, helper scripts, and XML parseability markers.
- `jmeter/tools/chat_manager_scenarios/README.md`
  - Short maintainer note explaining that `jmeter/data/chat-manager/*.jmx` is generated and how to regenerate it.

Create generated JMeter scenario plans:

- `jmeter/data/chat-manager/message-basic-lifecycle.jmx`
  - Peer text message lifecycle: discover contact, send, get, modify, get, delete locally, verify unavailable.
- `jmeter/data/chat-manager/message-send-types.jmx`
  - Peer send coverage for text, image, file, large file, voice, video, location, command, custom, plus invalid attachment local path regression.
- `jmeter/data/chat-manager/message-query.jmx`
  - Runtime-created peer messages used by ID, type, keyword, time-window, count, and history query APIs.
- `jmeter/data/chat-manager/message-recall-delete.jmx`
  - Local deletion, timestamp deletion, delete-before safety, recall, server removal by IDs, server removal by timestamp, and local conversation-message deletion.
- `jmeter/data/chat-manager/message-translation.jmx`
  - Supported languages, runtime text send, translate with `languages`, then retrieve.
- `jmeter/data/chat-manager/message-reaction.jmx`
  - Runtime peer message reaction add, list, detail, fetch, remove, and verify removal.
- `jmeter/data/chat-manager/message-pin.jmx`
  - Runtime peer message pin, pin info, local/server pinned message lists, unpin, and verify removal.
- `jmeter/data/chat-manager/message-conversation.jmx`
  - Conversation APIs after a runtime message establishes a peer conversation.
- `jmeter/data/chat-manager/message-target-types.jmx`
  - Send text messages to peer, joined group, public chat room, and chat thread targets.
- `jmeter/data/chat-manager/message-thread-management.jmx`
  - Group parent message, thread create/fetch/query/update/destroy lifecycle.

Modify documentation:

- `jmeter/README.md`
  - Add recursive/nested scenario execution examples.
  - Add generated-plan maintenance command.

Implementation references:

- `jmeter/data/rn-sdk-chat-manager.jmx`
  - Existing variable names and WebSocket sampler shape.
- `measured_app/src/biz/BizChatManager.ts`
  - Authoritative `info` field names and alias behavior for ChatManager.
- `measured_app/src/biz/BizChatContactManager.ts`
  - Contact discovery payload and response behavior.
- `measured_app/src/biz/BizChatGroupManager.ts`
  - Joined group discovery payload and response behavior.
- `measured_app/src/biz/BizChatRoomManager.ts`
  - Public room discovery, join, and leave payload behavior.
- `measured_app/src/dispatch/*.generated.ts`
  - Authoritative command names exposed through the WebSocket protocol.
- `measured_app/src/dispatch/Response.ts`
  - Confirms successful wrapper responses use `{ok:true,value:...}`.
- `measured_app/src/FileHelper.ts`
  - Fixture names supported by attachment send scenarios.

## Shared Scenario Rules

Every generated scenario plan must:

- Have exactly one normal `ThreadGroup`.
- Use one thread, one loop, sequential sampler order.
- Use `ThreadGroup.on_sample_error` set to `stopthread`.
- Avoid setUp Thread Groups and tearDown Thread Groups.
- Start with `ChatClient.init`, then `ChatClient.login`.
- End with `ChatClient.logout`.
- Open the WebSocket connection only in the init sampler with `createNewConnection=true`.
- Reuse the WebSocket connection for later samplers with `createNewConnection=false`.
- Attach `"ok":true` assertions to all samplers expected to reach a measured app API wrapper.
- Use JSR223 post-processors to set runtime variables after prerequisite and send samplers.
- Fail fast with `PRECONDITION_FAILED` and `ctx.getThread().stop()` when required runtime data cannot be extracted.
- Keep request payload field names aligned with measured app wrappers. Use `messageIds`, `languages`, `conversationType`, `convIds`, `msgTypes`, `body`, and other real wrapper fields. Do not add scenario-only field aliases such as `serverRemoveMessageIds`.
- Overwrite variable values between samplers when a later API needs a newly produced value.

Use these base JMeter variables in every scenario unless a scenario explicitly needs more:

```text
url=localhost
port=8083
timeout=200
topic=rn
appKey=easemob-demo#zuoyu
username=asterisk001
password=qwerty
contactUserId=
conversationId=
conversationType=PeerChat
messageId=
messageIds=
groupId=
roomId=
threadId=
cursor=
pageSize=20
count=20
direction=UP
isChatThread=false
```

## Shared Generator Contracts

`jmeter/tools/chat_manager_scenarios/generate.js` must expose these functions through `module.exports` so `generate.test.js` can test them without shelling out:

```javascript
module.exports = {
  buildAllPlans,
  buildPlan,
  scenarioDefinitions,
  xmlEscape,
}
```

The generator CLI must write all plans when run directly:

```bash
node jmeter/tools/chat_manager_scenarios/generate.js
```

Expected output:

```text
generated jmeter/data/chat-manager/message-basic-lifecycle.jmx
generated jmeter/data/chat-manager/message-send-types.jmx
generated jmeter/data/chat-manager/message-query.jmx
generated jmeter/data/chat-manager/message-recall-delete.jmx
generated jmeter/data/chat-manager/message-translation.jmx
generated jmeter/data/chat-manager/message-reaction.jmx
generated jmeter/data/chat-manager/message-pin.jmx
generated jmeter/data/chat-manager/message-conversation.jmx
generated jmeter/data/chat-manager/message-target-types.jmx
generated jmeter/data/chat-manager/message-thread-management.jmx
```

Use JavaScript objects for request payloads and `JSON.stringify(payload, null, 2)` before XML escaping. For raw JSON variable insertion such as `body:${body}` or `dict:${conversationExtension}`, let the generator accept an `infoJson` string for that sampler instead of forcing all payloads through `JSON.stringify`.

## Shared JSR223 Helper Contract

Add a JSR223 PreProcessor named `安装场景工具方法` near the start of every scenario after login. It must install closures into `vars` or `props` that later JSR223 scripts can call. The exact implementation can live as a string in `generate.js`, but it must provide these behaviors:

```groovy
import groovy.json.JsonOutput
import groovy.json.JsonSlurper

def parseResponse = {
  new JsonSlurper().parseText(prev.getResponseDataAsString())
}

def failPrecondition = { String scenario, String variableName, String reason ->
  def message = "PRECONDITION_FAILED: ${scenario} requires ${variableName}, but ${reason}"
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message, 'UTF-8')
  ctx.getThread().stop()
}

def requireString = { String scenario, String variableName, Object value, String reason ->
  if (value == null || value.toString().trim().isEmpty()) {
    failPrecondition(scenario, variableName, reason)
    return null
  }
  vars.put(variableName, value.toString())
  return value.toString()
}

def findFirstString = { Object node, List names ->
  if (node == null) {
    return null
  }
  if (node instanceof Map) {
    for (name in names) {
      if (node.containsKey(name) && node[name] != null && node[name].toString()) {
        return node[name].toString()
      }
    }
    for (entry in node.values()) {
      def found = findFirstString(entry, names)
      if (found != null) {
        return found
      }
    }
  }
  if (node instanceof List) {
    for (entry in node) {
      def found = findFirstString(entry, names)
      if (found != null) {
        return found
      }
    }
  }
  return null
}

def assertOk = { String scenario ->
  def root = parseResponse()
  if (!(root instanceof Map) || root.ok != true) {
    prev.setSuccessful(false)
    prev.setResponseMessage("${scenario} expected top-level ok=true")
  }
  return root
}
```

For `modifyMsgBody`, extract the message body from the latest `ChatManager.getMessage` response, mutate only the text payload, and store the full JSON object in `body`. Do not hand-build a partial body object unless implementation proves the SDK accepts it.

## Task 1: Baseline Inventory And Guardrails

**Files:**
- Read: `docs/superpowers/specs/2026-06-17-jmeter-chat-manager-scenarios-design.md`
- Read: `measured_app/src/biz/BizChatManager.ts`
- Read: `measured_app/src/biz/BizChatContactManager.ts`
- Read: `measured_app/src/biz/BizChatGroupManager.ts`
- Read: `measured_app/src/biz/BizChatRoomManager.ts`
- Read: `measured_app/src/dispatch/*.generated.ts`
- Read: `jmeter/data/rn-sdk-chat-manager.jmx`

- [ ] **Step 1: Confirm the worktree status**

Run:

```bash
git status --short
```

Expected: only unrelated user-owned files may appear. At the time this plan was written, `measured_app/.claude/` was untracked and should not be touched.

- [ ] **Step 2: Confirm required ChatManager routes exist**

Run:

```bash
rg "case 'ChatManager\\.(sendMessage|getMessage|modifyMsgBody|getMessagesWithIds|getMsgs|getMsgsWithMsgType|getConvMsgsWithKeyword|getMsgsWithKeyword|getConvsMsgsWithKeyword|getMsgWithTimestamp|getMessageCountWithTimestamp|searchMessages|searchMessagesInConversation|fetchHistoryMessagesByOptions|deleteMessage|deleteMessagesWithTimestamp|deleteMessagesBeforeTimestamp|recallMessage|removeMessagesFromServerWithMsgIds|removeMessagesFromServerWithTimestamp|translateMessage|fetchSupportedLanguages|addReaction|removeReaction|getReactionList|fetchReactionList|fetchReactionDetail|pinMessage|unpinMessage|getPinnedMessages|fetchPinnedMessages|getConversation|createChatThread|fetchChatThreadFromServer)'"
```

Expected: route matches in `measured_app/src/dispatch/ChatManager.generated.ts`. If a route is missing, inspect the generated dispatch file and wrapper before continuing.

- [ ] **Step 3: Confirm helper fields in BizChatManager**

Run:

```bash
rg -n "static (splitList|createConvType|createChatType|sendMessage|translateMessage|modifyMsgBody|getMessagesWithIds|removeMessagesFromServerWithMsgIds|setConversationExtension)" measured_app/src/biz/BizChatManager.ts
```

Expected:

```text
splitList
createConvType
createChatType
sendMessage
translateMessage
modifyMsgBody
getMessagesWithIds
removeMessagesFromServerWithMsgIds
setConversationExtension
```

- [ ] **Step 4: Confirm fixture names**

Run:

```bash
rg -n "test-image.jpg|test-audio.m4a|test-video.mp4|test-file.txt|test-large-8mb.bin" measured_app/src/FileHelper.ts
```

Expected: all five names are present.

## Task 2: Generator Skeleton And Tests

**Files:**
- Create: `jmeter/tools/chat_manager_scenarios/generate.js`
- Create: `jmeter/tools/chat_manager_scenarios/generate.test.js`
- Create: `jmeter/tools/chat_manager_scenarios/README.md`

- [ ] **Step 1: Write failing generator tests**

Create `jmeter/tools/chat_manager_scenarios/generate.test.js`:

```javascript
const assert = require('node:assert/strict')
const test = require('node:test')

const generator = require('./generate')

test('scenarioDefinitions lists the approved ten ChatManager scenario files', () => {
  assert.deepEqual(
    generator.scenarioDefinitions.map((scenario) => scenario.filename),
    [
      'message-basic-lifecycle.jmx',
      'message-send-types.jmx',
      'message-query.jmx',
      'message-recall-delete.jmx',
      'message-translation.jmx',
      'message-reaction.jmx',
      'message-pin.jmx',
      'message-conversation.jmx',
      'message-target-types.jmx',
      'message-thread-management.jmx',
    ],
  )
})

test('xmlEscape escapes request JSON for JMX string properties', () => {
  assert.equal(
    generator.xmlEscape('{"cmd":"ChatManager.sendMessage","ok":true}'),
    '{&quot;cmd&quot;:&quot;ChatManager.sendMessage&quot;,&quot;ok&quot;:true}',
  )
})

test('buildAllPlans returns one plan per scenario', () => {
  const plans = generator.buildAllPlans()

  assert.equal(Object.keys(plans).length, 10)
  assert.match(plans['message-basic-lifecycle.jmx'], /ChatManager\.sendMessage/)
  assert.match(plans['message-thread-management.jmx'], /ChatManager\.createChatThread/)
})

test('generated plans use ordinary thread groups and stable payload fields', () => {
  const plans = generator.buildAllPlans()

  for (const [filename, xml] of Object.entries(plans)) {
    assert.match(xml, /<ThreadGroup\b/)
    assert.doesNotMatch(xml, /setUpThreadGroup/)
    assert.doesNotMatch(xml, /PostThreadGroup/)
    assert.match(xml, /ThreadGroup\.on_sample_error">stopthread/)
    assert.match(xml, /&quot;ok&quot;:true/)
    assert.match(xml, /ChatClient\.init/)
    assert.match(xml, /ChatClient\.login/)
    assert.match(xml, /ChatClient\.logout/)
    assert.doesNotMatch(xml, /serverRemoveMessageIds/)
    assert.doesNotMatch(xml, /chatType&quot;:/)
    assert.doesNotMatch(xml, /lanuages/)
    assert.ok(filename.endsWith('.jmx'))
  }
})

test('scenario plans include required dynamic extraction helpers', () => {
  const xml = generator.buildPlan(
    generator.scenarioDefinitions.find(
      (scenario) => scenario.filename === 'message-basic-lifecycle.jmx',
    ),
  )

  assert.match(xml, /安装场景工具方法/)
  assert.match(xml, /PRECONDITION_FAILED/)
  assert.match(xml, /ctx\.getThread\(\)\.stop\(\)/)
  assert.match(xml, /vars\.put\('messageId'/)
  assert.match(xml, /vars\.put\('messageIds'/)
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: FAIL because `./generate` does not exist yet.

- [ ] **Step 3: Create the minimal generator skeleton**

Create `jmeter/tools/chat_manager_scenarios/generate.js` with:

```javascript
const fs = require('node:fs')
const path = require('node:path')

const outputDir = path.resolve(__dirname, '../../data/chat-manager')

const scenarioDefinitions = [
  { filename: 'message-basic-lifecycle.jmx', name: 'message-basic-lifecycle', samplers: [] },
  { filename: 'message-send-types.jmx', name: 'message-send-types', samplers: [] },
  { filename: 'message-query.jmx', name: 'message-query', samplers: [] },
  { filename: 'message-recall-delete.jmx', name: 'message-recall-delete', samplers: [] },
  { filename: 'message-translation.jmx', name: 'message-translation', samplers: [] },
  { filename: 'message-reaction.jmx', name: 'message-reaction', samplers: [] },
  { filename: 'message-pin.jmx', name: 'message-pin', samplers: [] },
  { filename: 'message-conversation.jmx', name: 'message-conversation', samplers: [] },
  { filename: 'message-target-types.jmx', name: 'message-target-types', samplers: [] },
  { filename: 'message-thread-management.jmx', name: 'message-thread-management', samplers: [] },
]

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function buildPlan(scenario) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${xmlEscape(scenario.name)}">
      <boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp>
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="${xmlEscape(scenario.name)}" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">stopthread</stringProp>
      </ThreadGroup>
      <hashTree>
        <!-- ChatClient.init ChatClient.login 安装场景工具方法 PRECONDITION_FAILED ctx.getThread().stop() vars.put('messageId','') vars.put('messageIds','') ChatClient.logout &quot;ok&quot;:true ChatManager.sendMessage ChatManager.createChatThread -->
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
`
}

function buildAllPlans() {
  return Object.fromEntries(
    scenarioDefinitions.map((scenario) => [scenario.filename, buildPlan(scenario)]),
  )
}

function writeAllPlans() {
  fs.mkdirSync(outputDir, { recursive: true })
  for (const [filename, xml] of Object.entries(buildAllPlans())) {
    const target = path.join(outputDir, filename)
    fs.writeFileSync(target, xml)
    console.log(`generated ${path.relative(process.cwd(), target)}`)
  }
}

if (require.main === module) {
  writeAllPlans()
}

module.exports = {
  buildAllPlans,
  buildPlan,
  scenarioDefinitions,
  xmlEscape,
}
```

- [ ] **Step 4: Run tests and verify the skeleton passes**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS. Later tasks replace placeholder comments with real JMX samplers and strengthen tests.

- [ ] **Step 5: Add maintainer README**

Create `jmeter/tools/chat_manager_scenarios/README.md` with this content:

```markdown
# ChatManager Scenario JMX Generator

The plans in `jmeter/data/chat-manager/` are generated by running:

node jmeter/tools/chat_manager_scenarios/generate.js

Keep scenario definitions in `generate.js` and run `node --test jmeter/tools/chat_manager_scenarios/generate.test.js` before committing generated `.jmx` changes.

The generated plans intentionally use normal ordered Thread Groups. Do not move init/login/logout into setUp or tearDown Thread Groups.
```

## Task 3: Real JMX Building Blocks

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Modify: `jmeter/tools/chat_manager_scenarios/generate.test.js`

- [ ] **Step 1: Strengthen tests for real JMX structure**

Append these tests to `generate.test.js`:

```javascript
test('generated plans include real JMeter variables and WebSocket sampler properties', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0])

  assert.match(xml, /<Arguments guiclass="ArgumentsPanel"/)
  assert.match(xml, /<stringProp name="Argument.name">appKey<\/stringProp>/)
  assert.match(xml, /<eu\.luminis\.jmeter\.wssampler\.RequestResponseWebSocketSampler/)
  assert.match(xml, /<boolProp name="createNewConnection">true<\/boolProp>/)
  assert.match(xml, /<boolProp name="createNewConnection">false<\/boolProp>/)
  assert.match(xml, /<stringProp name="path">\/iov\/websocket\/dual\?topic=\$\{topic\}<\/stringProp>/)
  assert.match(xml, /<ResponseAssertion\b/)
  assert.match(xml, /<JSR223PostProcessor\b/)
})

test('request payloads keep measured_app protocol field names', () => {
  const plans = generator.buildAllPlans()
  const allXml = Object.values(plans).join('\n')

  assert.match(allXml, /&quot;messageIds&quot;:&quot;\$\{messageIds\}&quot;/)
  assert.match(allXml, /&quot;languages&quot;:&quot;\$\{languages\}&quot;/)
  assert.match(allXml, /&quot;conversationType&quot;:&quot;\$\{conversationType\}&quot;/)
  assert.match(allXml, /&quot;convIds&quot;:&quot;\$\{convIds\}&quot;/)
  assert.match(allXml, /&quot;msgTypes&quot;:&quot;txt,img&quot;/)
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: FAIL because the skeleton does not emit real JMeter variables, WebSocket samplers, Response Assertions, or JSR223 post-processors.

- [ ] **Step 3: Implement XML helpers**

In `generate.js`, add helpers with these responsibilities:

```javascript
function argument(name, value) {
  return `<elementProp name="${xmlEscape(name)}" elementType="Argument"><stringProp name="Argument.name">${xmlEscape(name)}</stringProp><stringProp name="Argument.value">${xmlEscape(value)}</stringProp><stringProp name="Argument.metadata">=</stringProp></elementProp>`
}

function argumentsBlock(extraVariables = {}) {
  const variables = {
    url: 'localhost',
    port: '8083',
    timeout: '200',
    topic: 'rn',
    appKey: 'easemob-demo#zuoyu',
    username: 'asterisk001',
    password: 'qwerty',
    contactUserId: '',
    conversationId: '',
    conversationType: 'PeerChat',
    convIds: '',
    messageId: '',
    messageIds: '',
    groupId: '',
    roomId: '',
    threadId: '',
    cursor: '',
    pageSize: '20',
    count: '20',
    direction: 'UP',
    isChatThread: 'false',
    languages: 'en',
    body: '{}',
    options: '{}',
    dict: '{}',
    mark: '0',
    msgTypes: 'txt,img',
    ...extraVariables,
  }

  return `<Arguments guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables">
        <collectionProp name="Arguments.arguments">
          ${Object.entries(variables).map(([name, value]) => argument(name, value)).join('\n          ')}
        </collectionProp>
      </Arguments>
      <hashTree/>`
}

function okAssertion() {
  return `<ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="断言协议成功 ok=true" enabled="true"><collectionProp name="Asserion.test_strings"><stringProp name="358647012">&quot;ok&quot;:true</stringProp></collectionProp><stringProp name="Assertion.custom_message">response body must contain &quot;ok&quot;:true</stringProp><stringProp name="Assertion.test_field">Assertion.response_data</stringProp><boolProp name="Assertion.assume_success">false</boolProp><intProp name="Assertion.test_type">2</intProp></ResponseAssertion><hashTree/>`
}

function requestJson(cmd, info = {}, infoJson) {
  if (infoJson !== undefined) {
    return `{
  "type": 1,
  "objId": 10000,
  "cmd": "${cmd}",
  "device": "${'${topic}'}",
  "sequence": 1,
  "info": ${infoJson}
}`
  }
  return JSON.stringify(
    {
      type: 1,
      objId: 10000,
      cmd,
      device: '${topic}',
      sequence: 1,
      info,
    },
    null,
    2,
  )
}
```

- [ ] **Step 4: Implement sampler helpers**

Add these helpers:

```javascript
function wsSampler({ name, cmd, info, infoJson, newConnection = false, readTimeout = '${timeout}', enabled = true, children = '' }) {
  const requestData = xmlEscape(requestJson(cmd, info, infoJson))
  const connectionProps = newConnection
    ? `<boolProp name="createNewConnection">true</boolProp><boolProp name="TLS">false</boolProp><stringProp name="server">\${url}</stringProp><stringProp name="port">\${port}</stringProp><stringProp name="path">/iov/websocket/dual?topic=\${topic}</stringProp><stringProp name="connectTimeout">\${timeout}</stringProp>`
    : `<boolProp name="createNewConnection">false</boolProp><boolProp name="TLS">false</boolProp><stringProp name="server"></stringProp><stringProp name="port">80</stringProp><stringProp name="path"></stringProp>`

  return `<eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="${xmlEscape(name)}" enabled="${enabled ? 'true' : 'false'}">${connectionProps}<boolProp name="binaryPayload">false</boolProp><stringProp name="requestData">${requestData}</stringProp><stringProp name="readTimeout">${xmlEscape(readTimeout)}</stringProp><boolProp name="loadDataFromFile">false</boolProp><stringProp name="dataFile"></stringProp></eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree>${okAssertion()}${children}</hashTree>`
}

function jsr223PostProcessor(name, script) {
  return `<JSR223PostProcessor guiclass="TestBeanGUI" testclass="JSR223PostProcessor" testname="${xmlEscape(name)}" enabled="true"><stringProp name="cacheKey">true</stringProp><stringProp name="filename"></stringProp><stringProp name="parameters"></stringProp><stringProp name="script">${xmlEscape(script)}</stringProp><stringProp name="scriptLanguage">groovy</stringProp></JSR223PostProcessor><hashTree/>`
}

function jsr223PreProcessor(name, script) {
  return `<JSR223PreProcessor guiclass="TestBeanGUI" testclass="JSR223PreProcessor" testname="${xmlEscape(name)}" enabled="true"><stringProp name="cacheKey">true</stringProp><stringProp name="filename"></stringProp><stringProp name="parameters"></stringProp><stringProp name="script">${xmlEscape(script)}</stringProp><stringProp name="scriptLanguage">groovy</stringProp></JSR223PreProcessor><hashTree/>`
}
```

- [ ] **Step 5: Implement shared init/login/logout and helper install**

Add functions:

```javascript
function initSampler() {
  return wsSampler({
    name: '初始化',
    cmd: 'ChatClient.init',
    newConnection: true,
    info: { appKey: '${appKey}', autoLogin: false, debugModel: true },
  })
}

function loginSampler() {
  return wsSampler({
    name: '登录',
    cmd: 'ChatClient.login',
    readTimeout: '60000',
    info: { username: '${username}', password: '${password}' },
  })
}

function logoutSampler() {
  return wsSampler({
    name: '退出登录',
    cmd: 'ChatClient.logout',
    info: {},
  })
}
```

Add the shared Groovy helper from the Shared JSR223 Helper Contract as `scenarioToolsScript`, and include it as a preprocessor or postprocessor named `安装场景工具方法` immediately after login. If JMeter execution shows closures stored in the script context are not visible across sampler scripts, inline the helper functions into each JSR223 script instead of using cross-sampler state.

- [ ] **Step 6: Replace `buildPlan` placeholder with real JMX**

Build each plan as:

```javascript
function buildPlan(scenario) {
  const samplerXml = [
    initSampler(),
    loginSampler(),
    jsr223PreProcessor('安装场景工具方法', scenarioToolsScript),
    ...scenario.samplers,
    logoutSampler(),
  ].join('\n        ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${xmlEscape(scenario.name)}"><boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp><elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables"><collectionProp name="Arguments.arguments"/></elementProp><boolProp name="TestPlan.functional_mode">false</boolProp><boolProp name="TestPlan.serialize_threadgroups">false</boolProp></TestPlan>
    <hashTree>
      ${argumentsBlock(scenario.variables)}
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="${xmlEscape(scenario.name)} 用例" enabled="true"><intProp name="ThreadGroup.num_threads">1</intProp><intProp name="ThreadGroup.ramp_time">1</intProp><boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp><stringProp name="ThreadGroup.on_sample_error">stopthread</stringProp><elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller"><stringProp name="LoopController.loops">1</stringProp><boolProp name="LoopController.continue_forever">false</boolProp></elementProp></ThreadGroup>
      <hashTree>
        ${samplerXml}
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
`
}
```

- [ ] **Step 7: Run generator tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 4: Prerequisite Discovery And Extraction Helpers

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Modify: `jmeter/tools/chat_manager_scenarios/generate.test.js`

- [ ] **Step 1: Add tests for prerequisite failure behavior**

Append:

```javascript
test('prerequisite discovery fails fast with named variables', () => {
  const allXml = Object.values(generator.buildAllPlans()).join('\n')

  for (const variableName of ['contactUserId', 'groupId', 'roomId', 'messageId', 'threadId']) {
    assert.match(allXml, new RegExp(`requires \\\\${variableName}|requires \\$\\{variableName\\}|${variableName}`))
  }

  assert.match(allXml, /ChatContactManager\.getAllContactsFromServer/)
  assert.match(allXml, /ChatGroupManager\.getJoinedGroups/)
  assert.match(allXml, /ChatRoomManager\.fetchPublicChatRoomsFromServer/)
})
```

- [ ] **Step 2: Implement reusable sampler builders**

Add helper functions for common protocol commands:

```javascript
function discoverContactSampler(scenarioName) {
  return wsSampler({
    name: '发现联系人',
    cmd: 'ChatContactManager.getAllContactsFromServer',
    info: {},
    children: jsr223PostProcessor('提取 contactUserId', `
def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def found = findFirstString(root.value, ['userId', 'userId_1', 'username', 'name'])
if (found == null) {
  def message = 'PRECONDITION_FAILED: ${scenarioName} requires contactUserId, but ChatContactManager.getAllContactsFromServer returned no usable contact'
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
} else {
  vars.put('contactUserId', found)
  vars.put('conversationId', found)
  vars.put('conversationType', 'PeerChat')
  vars.put('convIds', found)
}
`),
  })
}

function discoverGroupSampler(scenarioName, variableName = 'groupId') {
  return wsSampler({
    name: '发现已加入群组',
    cmd: 'ChatGroupManager.getJoinedGroups',
    info: {},
    children: jsr223PostProcessor(`提取 ${variableName}`, `
def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def found = findFirstString(root.value, ['groupId', 'groupID', 'id'])
if (found == null) {
  def message = 'PRECONDITION_FAILED: ${scenarioName} requires ${variableName}, but ChatGroupManager.getJoinedGroups returned no joined group'
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
} else {
  vars.put('${variableName}', found)
  vars.put('groupId', found)
}
`),
  })
}

function discoverRoomSampler(scenarioName) {
  return wsSampler({
    name: '发现公开聊天室',
    cmd: 'ChatRoomManager.fetchPublicChatRoomsFromServer',
    info: { pageNum: 1, pageSize: '${pageSize}' },
    children: jsr223PostProcessor('提取 roomId', `
def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def found = findFirstString(root.value, ['roomId', 'id'])
if (found == null) {
  def message = 'PRECONDITION_FAILED: ${scenarioName} requires roomId, but ChatRoomManager.fetchPublicChatRoomsFromServer returned no public room'
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
} else {
  vars.put('roomId', found)
}
`),
  })
}
```

If the exact response keys differ during JMeter verification, update the extraction key lists after classifying the failure as a JMeter scenario defect.

- [ ] **Step 3: Implement send-message extraction helper**

Add:

```javascript
function sendMessageSampler({ name, info, messageVar = 'messageId', extraScript = '' }) {
  return wsSampler({
    name,
    cmd: 'ChatManager.sendMessage',
    readTimeout: '60000',
    info,
    children: jsr223PostProcessor(`提取 ${messageVar}`, `
def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def found = findFirstString(root.value, ['msgId', 'messageId', 'localMsgId', 'id'])
if (found == null) {
  def message = 'PRECONDITION_FAILED: ${name} requires ${messageVar}, but ChatManager.sendMessage returned no message id'
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
} else {
  vars.put('${messageVar}', found)
  vars.put('messageId', found)
  vars.put('messageIds', found)
  ${extraScript}
}
`),
  })
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 5: Basic Lifecycle Scenario

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Generated: `jmeter/data/chat-manager/message-basic-lifecycle.jmx`

- [ ] **Step 1: Add scenario-specific test**

Append:

```javascript
test('basic lifecycle scenario follows send get modify delete get order', () => {
  const xml = generator.buildAllPlans()['message-basic-lifecycle.jmx']

  assert.match(xml, /发现联系人/)
  assert.ok(xml.indexOf('ChatManager.sendMessage') < xml.indexOf('ChatManager.getMessage'))
  assert.match(xml, /ChatManager\.modifyMsgBody/)
  assert.match(xml, /&quot;body&quot;:\$\{body\}/)
  assert.match(xml, /ChatManager\.deleteMessage/)
  assert.match(xml, /验证本地删除后不可用/)
})
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: FAIL because `message-basic-lifecycle` has no real samplers yet.

- [ ] **Step 3: Add lifecycle sampler definitions**

Set the `message-basic-lifecycle` scenario samplers to:

```javascript
[
  discoverContactSampler('message-basic-lifecycle'),
  sendMessageSampler({
    name: '发送 peer 文本消息',
    info: {
      type: 'text',
      username: '${contactUserId}',
      conversationType: '${conversationType}',
      content: 'jmeter basic lifecycle ${__time()}',
    },
  }),
  wsSampler({
    name: '获取发送的消息',
    cmd: 'ChatManager.getMessage',
    info: { messageId: '${messageId}' },
    children: jsr223PostProcessor('提取并修改 body', `
def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def body = root.value?.body
if (body == null) {
  def message = 'PRECONDITION_FAILED: message-basic-lifecycle requires body, but ChatManager.getMessage returned no message body'
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
} else {
  if (body.containsKey('content')) {
    body.content = 'jmeter basic lifecycle updated ' + System.currentTimeMillis()
  } else if (body.containsKey('text')) {
    body.text = 'jmeter basic lifecycle updated ' + System.currentTimeMillis()
  }
  vars.put('body', groovy.json.JsonOutput.toJson(body))
}
`),
  }),
  wsSampler({
    name: '修改消息 body',
    cmd: 'ChatManager.modifyMsgBody',
    infoJson: '{"messageId":"${messageId}","body":${body}}',
  }),
  wsSampler({
    name: '获取修改后的消息',
    cmd: 'ChatManager.getMessage',
    info: { messageId: '${messageId}' },
  }),
  wsSampler({
    name: '本地删除消息',
    cmd: 'ChatManager.deleteMessage',
    info: {
      conversationId: '${conversationId}',
      conversationType: '${conversationType}',
      messageId: '${messageId}',
    },
  }),
  wsSampler({
    name: '验证本地删除后不可用',
    cmd: 'ChatManager.getMessage',
    info: { messageId: '${messageId}' },
    children: jsr223PostProcessor('断言原消息不可用', `
def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def found = findFirstString(root.value, ['msgId', 'messageId', 'localMsgId', 'id'])
if (found != null && found == vars.get('messageId')) {
  prev.setSuccessful(false)
  prev.setResponseMessage('message-basic-lifecycle expected deleted local message to be unavailable')
}
`),
  }),
]
```

- [ ] **Step 4: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 6: Send Types Scenario

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Generated: `jmeter/data/chat-manager/message-send-types.jmx`

- [ ] **Step 1: Add scenario-specific test**

Append:

```javascript
test('send types scenario covers attachment fixtures and invalid local path', () => {
  const xml = generator.buildAllPlans()['message-send-types.jmx']

  for (const fixtureName of ['test-image.jpg', 'test-file.txt', 'test-large-8mb.bin', 'test-audio.m4a', 'test-video.mp4']) {
    assert.match(xml, new RegExp(fixtureName))
  }

  for (const type of ['text', 'image', 'file', 'voice', 'video', 'location', 'cmd', 'custom']) {
    assert.match(xml, new RegExp(`&quot;type&quot;:&quot;${type}&quot;`))
  }

  assert.match(xml, /missing-jmeter-file\.bin/)
})
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: FAIL until samplers are added.

- [ ] **Step 3: Add send-type samplers**

Set the scenario samplers to `discoverContactSampler('message-send-types')`, then one `sendMessageSampler` plus `ChatManager.getMessage` per type:

```javascript
sendMessageSampler({ name: '发送文本消息', messageVar: 'textMessageId', info: { type: 'text', username: '${contactUserId}', conversationType: 'PeerChat', content: 'jmeter text ${__time()}' } })
sendMessageSampler({ name: '发送图片消息', messageVar: 'imageMessageId', info: { type: 'image', username: '${contactUserId}', conversationType: 'PeerChat', fixtureName: 'test-image.jpg' } })
sendMessageSampler({ name: '发送文件消息', messageVar: 'fileMessageId', info: { type: 'file', username: '${contactUserId}', conversationType: 'PeerChat', fixtureName: 'test-file.txt', displayName: 'test-file.txt' } })
sendMessageSampler({ name: '发送大文件消息', messageVar: 'largeFileMessageId', info: { type: 'file', username: '${contactUserId}', conversationType: 'PeerChat', fixtureName: 'test-large-8mb.bin', displayName: 'test-large-8mb.bin' } })
sendMessageSampler({ name: '发送语音消息', messageVar: 'voiceMessageId', info: { type: 'voice', username: '${contactUserId}', conversationType: 'PeerChat', fixtureName: 'test-audio.m4a', displayName: 'test-audio.m4a', duration: 3 } })
sendMessageSampler({ name: '发送视频消息', messageVar: 'videoMessageId', info: { type: 'video', username: '${contactUserId}', conversationType: 'PeerChat', fixtureName: 'test-video.mp4', thumbnailLocalPath: '', displayName: 'test-video.mp4' } })
sendMessageSampler({ name: '发送位置消息', messageVar: 'locationMessageId', info: { type: 'location', username: '${contactUserId}', conversationType: 'PeerChat', latitude: 39.9, longitude: 116.4, address: 'Beijing' } })
sendMessageSampler({ name: '发送命令消息', messageVar: 'cmdMessageId', info: { type: 'cmd', username: '${contactUserId}', conversationType: 'PeerChat', action: 'jmeter-action' } })
sendMessageSampler({ name: '发送自定义消息', messageVar: 'customMessageId', info: { type: 'custom', username: '${contactUserId}', conversationType: 'PeerChat', event: 'jmeter-event', data: { source: 'jmeter' } } })
```

After each send, add `ChatManager.getMessage` with the type-specific variable and a lightweight postprocessor that fails if no matching message id is returned.

Add the negative case:

```javascript
wsSampler({
  name: '发送不存在本地路径文件应返回 SDK 错误',
  cmd: 'ChatManager.sendMessage',
  readTimeout: '60000',
  info: {
    type: 'file',
    username: '${contactUserId}',
    conversationType: 'PeerChat',
    localPath: '/tmp/missing-jmeter-file.bin',
    displayName: 'missing-jmeter-file.bin',
  },
  children: jsr223PostProcessor('断言无效路径返回 SDK 失败值', `
def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
if (!(root instanceof Map) || root.ok != true) {
  prev.setSuccessful(false)
  prev.setResponseMessage('invalid attachment path should still return through ok=true WebSocket wrapper')
} else if (root.value == null) {
  prev.setSuccessful(false)
  prev.setResponseMessage('invalid attachment path should return an SDK error value')
}
`),
})
```

- [ ] **Step 4: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 7: Query Scenario

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Generated: `jmeter/data/chat-manager/message-query.jmx`

- [ ] **Step 1: Add scenario-specific test**

Append:

```javascript
test('query scenario covers id type keyword time count and history APIs', () => {
  const xml = generator.buildAllPlans()['message-query.jmx']

  for (const cmd of [
    'ChatManager.getMessage',
    'ChatManager.getMessagesWithIds',
    'ChatManager.getMsgs',
    'ChatManager.getMsgsWithMsgType',
    'ChatManager.getConvMsgsWithKeyword',
    'ChatManager.getMsgsWithKeyword',
    'ChatManager.getConvsMsgsWithKeyword',
    'ChatManager.getMsgWithTimestamp',
    'ChatManager.getMessageCountWithTimestamp',
    'ChatManager.searchMessages',
    'ChatManager.searchMessagesInConversation',
    'ChatManager.fetchHistoryMessagesByOptions',
    'ChatManager.getMessageCount',
  ]) {
    assert.match(xml, new RegExp(cmd.replace('.', '\\\\.')))
  }

  assert.match(xml, /queryKeyword/)
  assert.match(xml, /&quot;msgType&quot;:&quot;txt&quot;/)
  assert.match(xml, /&quot;msgType&quot;:&quot;img&quot;/)
})
```

- [ ] **Step 2: Add query scenario samplers**

Implement this order:

1. Discover contact.
2. JSR223 sampler or preprocessor sets:

```groovy
def now = System.currentTimeMillis()
vars.put('queryKeyword', 'jmeter-query-' + now)
vars.put('startTime', String.valueOf(now - 10000))
vars.put('timestamp', String.valueOf(now + 60000))
```

3. Send two text messages containing `${queryKeyword}` and one image message with `test-image.jpg`; extract `queryTextMessageId1`, `queryTextMessageId2`, and `queryImageMessageId`.
4. JSR223 postprocessor sets:

```groovy
vars.put('messageIds', vars.get('queryTextMessageId1') + ',' + vars.get('queryTextMessageId2') + ',' + vars.get('queryImageMessageId'))
vars.put('endTime', String.valueOf(System.currentTimeMillis() + 60000))
vars.put('start', vars.get('startTime'))
vars.put('end', vars.get('endTime'))
```

5. Add the query command samplers listed in the test with the field names from the source spec.

- [ ] **Step 3: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 8: Recall And Delete Scenario

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Generated: `jmeter/data/chat-manager/message-recall-delete.jmx`

- [ ] **Step 1: Add scenario-specific test**

Append:

```javascript
test('recall delete scenario keeps destructive cases separate', () => {
  const xml = generator.buildAllPlans()['message-recall-delete.jmx']

  for (const cmd of [
    'ChatManager.deleteMessage',
    'ChatManager.deleteMessagesWithTimestamp',
    'ChatManager.deleteMessagesBeforeTimestamp',
    'ChatManager.recallMessage',
    'ChatManager.removeMessagesFromServerWithMsgIds',
    'ChatManager.removeMessagesFromServerWithTimestamp',
    'ChatManager.deleteConversationAllMessages',
  ]) {
    assert.match(xml, new RegExp(cmd.replace('.', '\\\\.')))
  }

  assert.match(xml, /localDeleteMessageId/)
  assert.match(xml, /serverRemoveMessageId/)
  assert.match(xml, /&quot;messageIds&quot;:&quot;\$\{messageIds\}&quot;/)
})
```

- [ ] **Step 2: Add recall/delete samplers**

Implement the seven cases from the source spec in order. Each case must create its own text message before deletion/recall/removal. For the server removal by message IDs case, use:

```javascript
sendMessageSampler({
  name: '发送服务端按 ID 删除目标消息',
  messageVar: 'serverRemoveMessageId',
  info: { type: 'text', username: '${contactUserId}', conversationType: 'PeerChat', content: 'jmeter server remove id ${__time()}' },
  extraScript: "vars.put('messageIds', found)",
})
```

Then call:

```javascript
wsSampler({
  name: '服务端按消息 ID 删除',
  cmd: 'ChatManager.removeMessagesFromServerWithMsgIds',
  info: {
    conversationId: '${conversationId}',
    conversationType: '${conversationType}',
    messageIds: '${messageIds}',
    isChatThread: false,
  },
})
```

Do not introduce a new request field name for this scenario.

- [ ] **Step 3: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 9: Translation, Reaction, And Pin Scenarios

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Generated: `jmeter/data/chat-manager/message-translation.jmx`
- Generated: `jmeter/data/chat-manager/message-reaction.jmx`
- Generated: `jmeter/data/chat-manager/message-pin.jmx`

- [ ] **Step 1: Add scenario-specific tests**

Append:

```javascript
test('translation scenario uses languages field', () => {
  const xml = generator.buildAllPlans()['message-translation.jmx']

  assert.match(xml, /ChatManager\.fetchSupportedLanguages/)
  assert.match(xml, /ChatManager\.translateMessage/)
  assert.match(xml, /&quot;languages&quot;:&quot;\$\{languages\}&quot;/)
  assert.doesNotMatch(xml, /lanuages/)
})

test('reaction scenario uses peer reaction fields and messageIds', () => {
  const xml = generator.buildAllPlans()['message-reaction.jmx']

  for (const cmd of [
    'ChatManager.addReaction',
    'ChatManager.getReactionList',
    'ChatManager.fetchReactionDetail',
    'ChatManager.fetchReactionList',
    'ChatManager.removeReaction',
  ]) {
    assert.match(xml, new RegExp(cmd.replace('.', '\\\\.')))
  }

  assert.match(xml, /&quot;messageIds&quot;:&quot;\$\{messageIds\}&quot;/)
  assert.match(xml, /&quot;conversationType&quot;:&quot;PeerChat&quot;/)
})

test('pin scenario covers pin info local server lists and unpin', () => {
  const xml = generator.buildAllPlans()['message-pin.jmx']

  for (const cmd of [
    'ChatManager.pinMessage',
    'ChatManager.getMessagePinInfo',
    'ChatManager.getPinnedMessages',
    'ChatManager.fetchPinnedMessages',
    'ChatManager.unpinMessage',
  ]) {
    assert.match(xml, new RegExp(cmd.replace('.', '\\\\.')))
  }
})
```

- [ ] **Step 2: Add translation scenario**

Implement:

1. Discover contact.
2. `ChatManager.fetchSupportedLanguages`.
3. Send text message and extract `translationMessageId`.
4. `ChatManager.translateMessage` with:

```json
{"messageId":"${translationMessageId}","languages":"${languages}"}
```

5. `ChatManager.getMessage`.

If JMeter verification shows translation is unavailable for the account, classify the failure as environment/account state before changing assertions.

- [ ] **Step 3: Add reaction scenario**

Implement:

1. Discover contact.
2. JSR223 sets `reaction=jmeter-reaction-${__time()}`.
3. Send peer text message and extract `reactionMessageId`; set `messageId` and `messageIds`.
4. `ChatManager.getMessage`.
5. `ChatManager.addReaction`.
6. `ChatManager.getReactionList`.
7. `ChatManager.fetchReactionDetail`.
8. `ChatManager.fetchReactionList` with `messageIds`, `conversationType=PeerChat`, and empty `groupId`.
9. `ChatManager.removeReaction`.
10. `ChatManager.getReactionList`.

If `fetchReactionList` proves to be group-only, stop and confirm whether to move that case to `message-target-types` or `message-thread-management`.

- [ ] **Step 4: Add pin scenario**

Implement:

1. Discover contact.
2. Send peer text message and extract `pinMessageId`.
3. `ChatManager.getMessage`.
4. `ChatManager.pinMessage`.
5. `ChatManager.getMessagePinInfo`.
6. `ChatManager.getPinnedMessages`.
7. `ChatManager.fetchPinnedMessages`.
8. `ChatManager.unpinMessage`.
9. `ChatManager.getPinnedMessages`.

- [ ] **Step 5: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 10: Conversation Scenario

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Generated: `jmeter/data/chat-manager/message-conversation.jmx`

- [ ] **Step 1: Add scenario-specific test**

Append:

```javascript
test('conversation scenario covers conversation APIs without global destructive delete', () => {
  const xml = generator.buildAllPlans()['message-conversation.jmx']

  for (const cmd of [
    'ChatManager.getConversation',
    'ChatManager.getAllConversations',
    'ChatManager.getLatestMessage',
    'ChatManager.getLatestReceivedMessage',
    'ChatManager.getUnreadCount',
    'ChatManager.getConversationUnreadCount',
    'ChatManager.getConversationMessageCount',
    'ChatManager.markMessageAsRead',
    'ChatManager.markAllMessagesAsRead',
    'ChatManager.sendConversationReadAck',
    'ChatManager.setConversationExtension',
    'ChatManager.pinConversation',
    'ChatManager.fetchPinnedConversationsFromServerWithCursor',
    'ChatManager.addRemoteAndLocalConversationsMark',
    'ChatManager.fetchConversationsByOptions',
    'ChatManager.deleteRemoteAndLocalConversationsMark',
    'ChatManager.fetchConversationsFromServerWithCursor',
    'ChatManager.deleteConversation',
    'ChatManager.removeConversationFromServer',
  ]) {
    assert.match(xml, new RegExp(cmd.replace('.', '\\\\.')))
  }

  assert.doesNotMatch(xml, /deleteAllMessageAndConversation/)
  assert.match(xml, /&quot;dict&quot;:\$\{dict\}/)
})
```

- [ ] **Step 2: Add conversation samplers**

Implement the 22-step scenario from the spec. Use these important payload shapes:

```javascript
wsSampler({
  name: '设置会话扩展',
  cmd: 'ChatManager.setConversationExtension',
  infoJson: '{"conversationId":"${conversationId}","conversationType":"${conversationType}","dict":${dict}}',
})
```

Before that sampler, set:

```groovy
vars.put('dict', groovy.json.JsonOutput.toJson([source: 'jmeter', scenario: 'conversation']))
```

Use `mark: 0`, not `mark_0`, because `BizChatManager.createConversationMark` accepts numeric values and numeric strings.

- [ ] **Step 3: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 11: Target Types Scenario

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Generated: `jmeter/data/chat-manager/message-target-types.jmx`

- [ ] **Step 1: Add scenario-specific test**

Append:

```javascript
test('target types scenario sends to peer group room and thread', () => {
  const xml = generator.buildAllPlans()['message-target-types.jmx']

  assert.match(xml, /ChatContactManager\.getAllContactsFromServer/)
  assert.match(xml, /ChatGroupManager\.getJoinedGroups/)
  assert.match(xml, /ChatRoomManager\.fetchPublicChatRoomsFromServer/)
  assert.match(xml, /ChatRoomManager\.joinChatRoom/)
  assert.match(xml, /ChatRoomManager\.leaveChatRoom/)
  assert.match(xml, /ChatManager\.createChatThread/)
  assert.match(xml, /&quot;conversationType&quot;:&quot;GroupChat&quot;/)
  assert.match(xml, /&quot;conversationType&quot;:&quot;ChatRoom&quot;/)
  assert.match(xml, /&quot;isChatThread&quot;:true/)
  assert.doesNotMatch(xml, /&quot;chatType&quot;:/)
})
```

- [ ] **Step 2: Add target-type samplers**

Implement the four cases from the spec:

1. Peer contact discovery, peer send, peer get.
2. Joined group discovery, group send, group get, group latest message.
3. Public chat room discovery, join room, room send, room get, leave room.
4. Joined group discovery if needed, send parent group message, create thread, send thread message with `username=${threadId}`, `conversationType=GroupChat`, and `isChatThread=true`, then get thread message.

Use `conversationType` or existing `convType` only. Do not use request field `chatType`.

- [ ] **Step 3: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 12: Thread Management Scenario

**Files:**
- Modify: `jmeter/tools/chat_manager_scenarios/generate.js`
- Generated: `jmeter/data/chat-manager/message-thread-management.jmx`

- [ ] **Step 1: Add scenario-specific test**

Append:

```javascript
test('thread management scenario covers dynamic thread lifecycle', () => {
  const xml = generator.buildAllPlans()['message-thread-management.jmx']

  for (const cmd of [
    'ChatGroupManager.getJoinedGroups',
    'ChatManager.sendMessage',
    'ChatManager.createChatThread',
    'ChatManager.fetchChatThreadFromServer',
    'ChatManager.getMessageThread',
    'ChatManager.getThreadConversation',
    'ChatManager.fetchMembersWithChatThreadFromServer',
    'ChatManager.fetchChatThreadWithParentFromServer',
    'ChatManager.fetchJoinedChatThreadWithParentFromServer',
    'ChatManager.fetchJoinedChatThreadFromServer',
    'ChatManager.fetchLastMessageWithChatThread',
    'ChatManager.updateChatThreadName',
    'ChatManager.destroyChatThread',
  ]) {
    assert.match(xml, new RegExp(cmd.replace('.', '\\\\.')))
  }

  assert.doesNotMatch(xml, /removeMemberWithChatThread/)
})
```

- [ ] **Step 2: Add thread-management samplers**

Implement:

1. `ChatGroupManager.getJoinedGroups`; extract `threadParentGroupId`.
2. `ChatManager.sendMessage`; send parent group text and extract `threadParentMessageId`.
3. `ChatManager.createChatThread`; use `name=jmeter-thread-${__time()}`, `msgId=${threadParentMessageId}`, `groupId=${threadParentGroupId}`.
4. Extract `threadId` using `findFirstString(root.value, ['threadId', 'chatThreadId', 'id'])`.
5. Add the remaining thread query/update/destroy samplers from the source spec.

Do not include `ChatManager.removeMemberWithChatThread`.

- [ ] **Step 3: Run tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

## Task 13: Generate Plans And Static Verification

**Files:**
- Generated: `jmeter/data/chat-manager/*.jmx`

- [ ] **Step 1: Generate all scenario JMX files**

Run:

```bash
node jmeter/tools/chat_manager_scenarios/generate.js
```

Expected: ten `generated ...` lines matching the approved filenames.

- [ ] **Step 2: Run generator tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

- [ ] **Step 3: Confirm generated file count**

Run:

```bash
find jmeter/data/chat-manager -maxdepth 1 -name '*.jmx' | sort
```

Expected:

```text
jmeter/data/chat-manager/message-basic-lifecycle.jmx
jmeter/data/chat-manager/message-conversation.jmx
jmeter/data/chat-manager/message-pin.jmx
jmeter/data/chat-manager/message-query.jmx
jmeter/data/chat-manager/message-reaction.jmx
jmeter/data/chat-manager/message-recall-delete.jmx
jmeter/data/chat-manager/message-send-types.jmx
jmeter/data/chat-manager/message-target-types.jmx
jmeter/data/chat-manager/message-thread-management.jmx
jmeter/data/chat-manager/message-translation.jmx
```

- [ ] **Step 4: Validate JMX can be loaded by JMeter**

Run for each generated plan:

```bash
for f in jmeter/data/chat-manager/*.jmx; do
  /Applications/apache-jmeter-5.6.3/bin/jmeter -n -t "$f" -l "/tmp/$(basename "$f" .jmx)-dry.jtl" -j "/tmp/$(basename "$f" .jmx)-dry.log" -Jurl=127.0.0.1 -Jport=1 || true
done
```

Expected: JMeter should parse each file and fail at connection time only. If any log reports XML parse errors or class/property load errors, fix the generator before runtime testing.

## Task 14: Runtime JMeter Verification And Failure Classification

**Files:**
- Runtime outputs only: `/tmp/rn-wayang-chat-manager-scenarios/`

This task requires `forward_server` running on `localhost:8083`, `measured_app` connected to the relay, and the test account logged out or ready for clean login.

- [ ] **Step 1: Run one low-risk scenario first**

Run:

```bash
mkdir -p /tmp/rn-wayang-chat-manager-scenarios
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/chat-manager/message-basic-lifecycle.jmx \
  -l /tmp/rn-wayang-chat-manager-scenarios/message-basic-lifecycle.jtl \
  -j /tmp/rn-wayang-chat-manager-scenarios/message-basic-lifecycle.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Expected: `Err: 0 (0.00%)`.

- [ ] **Step 2: Inspect failures before changing anything**

Run:

```bash
rg -n 's="false"|<failure>true|PRECONDITION_FAILED|protocol_error|WebSocket I/O error|Sampler error|there is no connection' /tmp/rn-wayang-chat-manager-scenarios/message-basic-lifecycle.*
```

Expected: no output for a clean pass. If there is output, classify the failure as environment/account state, JMeter scenario defect, measured app wrapper defect, expected SDK/service behavior, or suspected SDK bug before editing.

- [ ] **Step 3: Run all scenario plans**

Run:

```bash
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

Expected: each final summary reports `Err: 0 (0.00%)`.

- [ ] **Step 4: Inspect all runtime outputs**

Run:

```bash
rg -n 's="false"|<failure>true|PRECONDITION_FAILED|protocol_error|WebSocket I/O error|Sampler error|there is no connection' /tmp/rn-wayang-chat-manager-scenarios
```

Expected: no output. If output appears, use the failure classification from the source spec. For significant failures or changes to semantics, pause and confirm with the user before proceeding.

## Task 15: README Updates

**Files:**
- Modify: `jmeter/README.md`

- [ ] **Step 1: Add README text**

Add this section after the current top-level loop:

```markdown
Run all ChatManager scenario plans under `jmeter/data/chat-manager/`:

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

Run both top-level coverage plans and nested scenario plans:

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

The ChatManager scenario plans are generated by running:

node jmeter/tools/chat_manager_scenarios/generate.js
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

- [ ] **Step 2: Run Markdown-sensitive search**

Run:

```bash
rg -n "chat-manager|generate.js|find jmeter/data" jmeter/README.md
```

Expected: the new commands are visible.

## Task 16: Final Verification And Batch Commit

**Files:**
- All files modified by this plan.

- [ ] **Step 1: Run static tests**

Run:

```bash
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

Expected: PASS.

- [ ] **Step 2: Regenerate and ensure no diff churn**

Run:

```bash
node jmeter/tools/chat_manager_scenarios/generate.js
git diff -- jmeter/data/chat-manager
```

Expected: either no diff, or only the intended generated JMX changes.

- [ ] **Step 3: Check whitespace**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 4: Run JMeter runtime verification**

Run Task 14 if the environment is available. If the measured app or relay is not available, state that runtime verification was not run and include the exact missing prerequisite.

- [ ] **Step 5: Review changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected changed files:

```text
jmeter/README.md
jmeter/tools/chat_manager_scenarios/README.md
jmeter/tools/chat_manager_scenarios/generate.js
jmeter/tools/chat_manager_scenarios/generate.test.js
jmeter/data/chat-manager/message-basic-lifecycle.jmx
jmeter/data/chat-manager/message-send-types.jmx
jmeter/data/chat-manager/message-query.jmx
jmeter/data/chat-manager/message-recall-delete.jmx
jmeter/data/chat-manager/message-translation.jmx
jmeter/data/chat-manager/message-reaction.jmx
jmeter/data/chat-manager/message-pin.jmx
jmeter/data/chat-manager/message-conversation.jmx
jmeter/data/chat-manager/message-target-types.jmx
jmeter/data/chat-manager/message-thread-management.jmx
```

Do not stage unrelated files such as `measured_app/.claude/`.

- [ ] **Step 6: Commit the batch**

Run:

```bash
git add jmeter/README.md jmeter/tools/chat_manager_scenarios jmeter/data/chat-manager
git commit -m "test: add chat manager jmeter scenarios"
```

Expected: one commit containing the full scenario-suite implementation batch.

## Self-Review Notes

- Spec coverage: the plan maps all ten source scenario categories to generated `.jmx` files and includes README updates for nested execution.
- Runtime variables: the plan requires stable request field names and runtime variable overwrites, including `messageIds`, `languages`, `conversationType`, and `convIds`.
- Thread model: the plan explicitly forbids setUp/tearDown Thread Groups and uses normal ordered samplers.
- Failure analysis: runtime verification tasks require classification before edits, and significant semantic changes require user confirmation.
- Commit strategy: the plan uses a final batch commit instead of per-task commits, matching the user request.
