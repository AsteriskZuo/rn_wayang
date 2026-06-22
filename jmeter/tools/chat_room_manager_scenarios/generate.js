const fs = require('node:fs');
const path = require('node:path');

const defaultOutputDir = path.resolve(__dirname, '../../data/chat-room-manager');

const expectedAccountKeys = [
  'APP_KEY',
  'DEFAULT_PASSWORD',
  'PRIMARY_USERNAME',
  'PRIMARY_PASSWORD',
];

const expectedRelationshipKeys = [
  'APP_KEY',
  'PRIMARY_USERNAME',
  'CONTACT_FIXTURE_READY',
  'ROOM_ID',
  'ROOM_OWNER_USERNAME',
  'ROOM_MEMBER_USERNAME_1',
  'ROOM_MEMBER_USERNAME_2',
  'ROOM_NON_MEMBER_USERNAME_1',
  'ROOM_NON_MEMBER_USERNAME_2',
];

const sharedFixtureKeys = ['APP_KEY', 'PRIMARY_USERNAME'];

const baseVariables = [
  ['url', '${__P(url,localhost)}'],
  ['port', '${__P(port,8083)}'],
  ['timeout', '${__P(timeout,10000)}'],
  ['topic', '${__P(topic,rn)}'],
  ['accountsEnvPath', '${__P(accountsEnvPath,jmeter/data-fixtures/.state/accounts.env)}'],
  ['relationshipsEnvPath', '${__P(relationshipsEnvPath,jmeter/data-fixtures/.state/relationships.env)}'],
  ['appKey', ''],
  ['username', ''],
  ['password', ''],
  ['defaultPassword', ''],
  ['primaryUserId', ''],
  ['roomId', ''],
  ['roomOwnerUserId', ''],
  ['roomMemberUserId1', ''],
  ['roomMemberUserId2', ''],
  ['roomNonMemberUserId1', ''],
  ['roomNonMemberUserId2', ''],
  ['roomMembersCsv', ''],
  ['roomName', 'chat room scenario ${__time()}'],
  ['roomDesc', 'chat room scenario ${__time()}'],
  ['roomExt', 'jmeter-chat-room-scenario-${__time()}'],
  ['roomAnnouncement', 'chat room scenario ${__time()}'],
  ['roomWelcome', 'chat room scenario welcome ${__time()}'],
  ['roomReason', 'chat room scenario reason ${__time()}'],
  ['muteDuration', '60000'],
  ['pageNum', '1'],
  ['pageSize', '20'],
  ['cursor', ''],
  ['createdRoomId', ''],
  ['createdRoomName', 'jmeter-created-chat-room-${__time()}'],
  ['createdRoomDesc', 'created by jmeter chat room scenario'],
  ['createdRoomMaxCount', '20'],
  ['roomAttributeKey', 'jmeter_attr_${__time()}'],
  ['roomAttributeValue', 'chat-room-attr-${__time()}'],
];

const helperScript = `import groovy.json.JsonOutput
import groovy.json.JsonSlurper

def parseResponse = {
  new JsonSlurper().parseText(prev.getResponseDataAsString())
}

def failPrecondition = { String scenario, String reason ->
  def message = "PRECONDITION_FAILED: \${scenario} \${reason}"
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message, 'UTF-8')
  ctx.getThread().stop()
}

def responseValue = {
  def root = parseResponse()
  if (!(root instanceof Map) || root.ok != true) {
    prev.setSuccessful(false)
    prev.setResponseCode('ASSERTION_FAILED')
    prev.setResponseMessage('expected top-level ok=true')
    return null
  }
  return root.value
}

def flattenStrings
flattenStrings = { Object node ->
  def out = []
  if (node == null) {
    return out
  }
  if (node instanceof CharSequence || node instanceof Number || node instanceof Boolean) {
    out << node.toString()
    return out
  }
  if (node instanceof Map) {
    ['roomId', 'roomID', 'roomid', 'id', 'owner', 'member', 'userId', 'username', 'name', 'fileId', 'file_id'].each { key ->
      if (node.containsKey(key) && node[key] != null) {
        out << node[key].toString()
      }
    }
    node.keySet().each { key ->
      if (key != null) {
        out << key.toString()
      }
    }
    node.values().each { out.addAll(flattenStrings(it)) }
    return out
  }
  if (node instanceof List) {
    node.each { out.addAll(flattenStrings(it)) }
  }
  return out
}

def findFirstByKeys
findFirstByKeys = { Object node, List keys ->
  if (node == null) {
    return null
  }
  if (node instanceof Map) {
    for (key in keys) {
      if (node.containsKey(key) && node[key] != null && node[key].toString().trim()) {
        return node[key].toString()
      }
    }
    for (entry in node.values()) {
      def found = findFirstByKeys(entry, keys)
      if (found != null) {
        return found
      }
    }
  }
  if (node instanceof List) {
    for (entry in node) {
      def found = findFirstByKeys(entry, keys)
      if (found != null) {
        return found
      }
    }
  }
  return null
}

def requireValue = { String scenario, String variableName ->
  def value = vars.get(variableName)
  if (value == null || value.trim().isEmpty()) {
    failPrecondition(scenario, "requires \${variableName} from fixture env or previous sampler")
    return null
  }
  return value
}

vars.putObject('roomScenarioParseResponse', parseResponse)
vars.putObject('roomScenarioResponseValue', responseValue)
vars.putObject('roomScenarioFlattenStrings', flattenStrings)
vars.putObject('roomScenarioFindFirstByKeys', findFirstByKeys)
vars.putObject('roomScenarioRequireValue', requireValue)
vars.putObject('roomScenarioFailPrecondition', failPrecondition)
`;

const loadFixtureScript = `import java.nio.file.Files
import java.nio.file.Paths

def result = SampleResult
def fail = { String reason ->
  def message = 'PRECONDITION_FAILED: ' + reason
  result.setSuccessful(false)
  result.setResponseCode('PRECONDITION_FAILED')
  result.setResponseMessage(message)
  result.setResponseData(message + '\\nRun yarn prepare:accounts and run or repair yarn reset:relationships.', 'UTF-8')
  ctx.getThread().stop()
  throw new IllegalStateException(message)
}

def readEnv = { String pathValue, String label ->
  if (pathValue == null || pathValue.trim().isEmpty()) {
    fail(label + ' path is empty')
    return [:]
  }
  def file = Paths.get(pathValue)
  if (!Files.exists(file)) {
    fail(label + ' not found at ' + pathValue)
    return [:]
  }
  def values = [:]
  Files.readAllLines(file).each { line ->
    def trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      def index = trimmed.indexOf('=')
      if (index > 0) {
        values[trimmed.substring(0, index)] = trimmed.substring(index + 1)
      }
    }
  }
  return values
}

def requireKeys = { Map values, List keys, String label ->
  keys.each { key ->
    if (!values.containsKey(key) || values[key] == null || values[key].toString().trim().isEmpty()) {
      fail(label + ' missing required key ' + key)
    }
  }
}

def accounts = readEnv(vars.get('accountsEnvPath'), 'accounts.env')
def relationships = readEnv(vars.get('relationshipsEnvPath'), 'relationships.env')
def accountKeys = ${JSON.stringify(expectedAccountKeys)}
def relationshipKeys = ${JSON.stringify(expectedRelationshipKeys)}
def sharedKeys = ${JSON.stringify(sharedFixtureKeys)}

requireKeys(accounts, accountKeys, 'accounts.env')
requireKeys(relationships, relationshipKeys, 'relationships.env')

sharedKeys.each { key ->
  if (accounts[key]?.toString() != relationships[key]?.toString()) {
    fail('shared fixture key mismatch for ' + key)
  }
}

if (relationships.CONTACT_FIXTURE_READY?.toString() != 'true') {
  fail('CONTACT_FIXTURE_READY=true marker missing; run or repair yarn reset:relationships')
}

vars.put('appKey', props.get('appKey') ?: accounts.APP_KEY)
vars.put('username', props.get('username') ?: relationships.ROOM_OWNER_USERNAME)
vars.put('password', props.get('password') ?: accounts.DEFAULT_PASSWORD)
vars.put('defaultPassword', accounts.DEFAULT_PASSWORD)
vars.put('primaryUserId', accounts.PRIMARY_USERNAME)
vars.put('roomId', relationships.ROOM_ID)
vars.put('roomOwnerUserId', relationships.ROOM_OWNER_USERNAME)
vars.put('roomMemberUserId1', relationships.ROOM_MEMBER_USERNAME_1)
vars.put('roomMemberUserId2', relationships.ROOM_MEMBER_USERNAME_2)
vars.put('roomNonMemberUserId1', relationships.ROOM_NON_MEMBER_USERNAME_1)
vars.put('roomNonMemberUserId2', relationships.ROOM_NON_MEMBER_USERNAME_2)
vars.put('roomMembersCsv', relationships.ROOM_MEMBER_USERNAME_1 + ',' + relationships.ROOM_MEMBER_USERNAME_2)
result.setResponseData('CONTACT_FIXTURE_READY=true ROOM_ID=' + relationships.ROOM_ID, 'UTF-8')
`;

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function stringifyJsonWithRaw(value, space = 2) {
  const rawValues = [];
  const markerPrefix = '__RAW_JSON_';
  const markerSuffix = '__';
  const json = JSON.stringify(
    value,
    (_key, nestedValue) => {
      if (
        nestedValue &&
        typeof nestedValue === 'object' &&
        Object.hasOwn(nestedValue, '__rawJson')
      ) {
        const marker = `${markerPrefix}${rawValues.length}${markerSuffix}`;
        rawValues.push(nestedValue.__rawJson);
        return marker;
      }
      return nestedValue;
    },
    space,
  );

  return rawValues.reduce(
    (text, rawValue, index) =>
      text.replace(`"${markerPrefix}${index}${markerSuffix}"`, rawValue),
    json,
  );
}

function argument(name, value) {
  return `<elementProp name="${xmlEscape(name)}" elementType="Argument"><stringProp name="Argument.name">${xmlEscape(name)}</stringProp><stringProp name="Argument.value">${xmlEscape(value)}</stringProp><stringProp name="Argument.metadata">=</stringProp></elementProp>`;
}

function mergeVariables(extraVariables = []) {
  const variables = new Map(baseVariables);
  for (const [name, value] of extraVariables) {
    variables.set(name, value);
  }
  return [...variables.entries()];
}

function argumentsBlock(extraVariables) {
  const variables = mergeVariables(extraVariables);
  return `<Arguments guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables">
        <collectionProp name="Arguments.arguments">
          ${variables.map(([name, value]) => argument(name, value)).join('\n          ')}
        </collectionProp>
      </Arguments>
      <hashTree/>`;
}

function okAssertion() {
  return '<ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="断言协议成功 ok=true" enabled="true"><collectionProp name="Asserion.test_strings"><stringProp name="358647012">&quot;ok&quot;:true</stringProp></collectionProp><stringProp name="Assertion.custom_message">response body must contain &quot;ok&quot;:true</stringProp><stringProp name="Assertion.test_field">Assertion.response_data</stringProp><boolProp name="Assertion.assume_success">false</boolProp><intProp name="Assertion.test_type">2</intProp></ResponseAssertion><hashTree/>';
}

function sdkSuccessAssertion() {
  return jsr223PostProcessor(
    '断言 SDK 未返回明显错误',
    `import groovy.json.JsonSlurper

def rawResponse = prev.getResponseDataAsString()
if (rawResponse == null || rawResponse.trim().isEmpty()) {
  return
}

def root = new JsonSlurper().parseText(rawResponse)
def value = root instanceof Map ? root.value : null
if (value instanceof Map && value.containsKey('code') && value.containsKey('description')) {
  prev.setSuccessful(false)
  prev.setResponseCode('SDK_ERROR')
  prev.setResponseMessage('SDK returned ChatError-like value: ' + value.toString())
}`,
  );
}

function requestJson(cmd, info = {}, infoJson) {
  if (infoJson !== undefined) {
    return `{
  "type": 1,
  "objId": 10000,
  "cmd": "${cmd}",
  "device": "\${topic}",
  "sequence": 1,
  "info": ${infoJson}
}`;
  }

  return stringifyJsonWithRaw({
    type: 1,
    objId: 10000,
    cmd,
    device: '${topic}',
    sequence: 1,
    info,
  });
}

function wsSampler({
  name,
  cmd,
  info = {},
  infoJson,
  newConnection = false,
  readTimeout = '${timeout}',
  enabled = true,
  children = '',
  assertOk = true,
  assertSdkSuccess = true,
}) {
  const requestData = xmlEscape(requestJson(cmd, info, infoJson));
  const connectionProps = newConnection
    ? '<boolProp name="createNewConnection">true</boolProp><boolProp name="TLS">false</boolProp><stringProp name="server">${url}</stringProp><stringProp name="port">${port}</stringProp><stringProp name="path">/iov/websocket/dual?topic=${topic}</stringProp><stringProp name="connectTimeout">${timeout}</stringProp>'
    : '<boolProp name="createNewConnection">false</boolProp><boolProp name="TLS">false</boolProp><stringProp name="server"></stringProp><stringProp name="port">80</stringProp><stringProp name="path"></stringProp>';
  const assertion = assertOk ? okAssertion() : '';
  const sdkAssertion = assertOk && assertSdkSuccess ? sdkSuccessAssertion() : '';

  return `<eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="${xmlEscape(name)}" enabled="${enabled ? 'true' : 'false'}">${connectionProps}<boolProp name="binaryPayload">false</boolProp><stringProp name="requestData">${requestData}</stringProp><stringProp name="readTimeout">${xmlEscape(readTimeout)}</stringProp><boolProp name="loadDataFromFile">false</boolProp><stringProp name="dataFile"></stringProp></eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree>${assertion}${sdkAssertion}${children}</hashTree>`;
}

function jsr223PostProcessor(name, script) {
  return `<JSR223PostProcessor guiclass="TestBeanGUI" testclass="JSR223PostProcessor" testname="${xmlEscape(name)}" enabled="true"><stringProp name="cacheKey">true</stringProp><stringProp name="filename"></stringProp><stringProp name="parameters"></stringProp><stringProp name="script">${xmlEscape(script)}</stringProp><stringProp name="scriptLanguage">groovy</stringProp></JSR223PostProcessor><hashTree/>`;
}

function jsr223PreProcessor(name, script) {
  return `<JSR223PreProcessor guiclass="TestBeanGUI" testclass="JSR223PreProcessor" testname="${xmlEscape(name)}" enabled="true"><stringProp name="cacheKey">true</stringProp><stringProp name="filename"></stringProp><stringProp name="parameters"></stringProp><stringProp name="script">${xmlEscape(script)}</stringProp><stringProp name="scriptLanguage">groovy</stringProp></JSR223PreProcessor><hashTree/>`;
}

function scriptSampler(name, script, {enabled = true} = {}) {
  return `<JSR223Sampler guiclass="TestBeanGUI" testclass="JSR223Sampler" testname="${xmlEscape(name)}" enabled="${enabled ? 'true' : 'false'}"><stringProp name="cacheKey">true</stringProp><stringProp name="filename"></stringProp><stringProp name="parameters"></stringProp><stringProp name="script">${xmlEscape(script)}</stringProp><stringProp name="scriptLanguage">groovy</stringProp></JSR223Sampler><hashTree/>`;
}

function loadFixtureSampler() {
  return scriptSampler('Load fixture env', loadFixtureScript);
}

function initSampler() {
  return wsSampler({
    name: '初始化 ChatClient',
    cmd: 'ChatClient.init',
    newConnection: true,
    info: {appKey: '${appKey}', autoLogin: false, debugModel: true},
  });
}

function preCleanupLogoutSampler() {
  return wsSampler({
    name: '预清理退出登录',
    cmd: 'ChatClient.logout',
    info: {},
    assertSdkSuccess: false,
  });
}

function loginSampler() {
  return wsSampler({
    name: '登录主账号',
    cmd: 'ChatClient.login',
    readTimeout: '60000',
    info: {username: '${username}', password: '${password}'},
    assertSdkSuccess: false,
  });
}

function loginAsSampler({name, usernameVariable}) {
  return wsSampler({
    name,
    cmd: 'ChatClient.login',
    readTimeout: '60000',
    info: {username: `\${${usernameVariable}}`, password: '${defaultPassword}'},
    assertSdkSuccess: false,
  });
}

function logoutSampler() {
  return wsSampler({
    name: '退出登录',
    cmd: 'ChatClient.logout',
    info: {},
    assertSdkSuccess: false,
  });
}

function installHelpersSampler() {
  return jsr223PreProcessor('安装 ChatRoomManager 场景工具方法', helperScript);
}

function setVarsSampler(name, variables) {
  const script = Object.entries(variables)
    .map(([key, value]) => {
      const text = String(value);
      const variableMatch = text.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
      if (variableMatch) {
        return `vars.put('${key}', vars.get('${variableMatch[1]}') ?: '')`;
      }
      return `vars.put('${key}', '${text.replaceAll("'", "\\'")}')`;
    })
    .join('\n');
  return scriptSampler(name, script);
}

function groovyAssert(name, script) {
  return jsr223PostProcessor(name, `${helperScript}
if (!prev.isSuccessful()) {
  return
}
${script}`);
}

function assertStrings({name, scenario, present = [], absent = []}) {
  return groovyAssert(
    name,
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
def strings = flattenStrings(value) as Set
${JSON.stringify(present)}.each { variableName ->
  def expected = vars.get(variableName)
  if (expected == null || expected.trim().isEmpty() || !strings.contains(expected)) {
    failPrecondition('${scenario}', 'expected ' + variableName + ' to appear in response')
  }
}
${JSON.stringify(absent)}.each { variableName ->
  def unexpected = vars.get(variableName)
  if (unexpected != null && unexpected.trim() && strings.contains(unexpected)) {
    failPrecondition('${scenario}', 'expected ' + variableName + ' to be absent from response')
  }
}`,
  );
}

function assertValueEqualsVariable({name, scenario, variableName}) {
  return groovyAssert(
    name,
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
def expected = requireValue('${scenario}', '${variableName}')
if (!prev.isSuccessful()) {
  return
}
if (value == null || value.toString() != expected) {
  failPrecondition('${scenario}', 'expected response value to equal ${variableName}')
}`,
  );
}

function extractFirstByKeys({name, scenario, variableName, keys}) {
  return groovyAssert(
    name,
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
def found = findFirstByKeys(value, ${JSON.stringify(keys)})
if (found == null || found.trim().isEmpty()) {
  failPrecondition('${scenario}', 'requires ${variableName} from response')
  return
}
vars.put('${variableName}', found)`,
  );
}

const scenarioDefinitions = [
  {
    filename: 'chat-room-info-query.jmx',
    name: 'Chat Room Info Query',
    variables: [],
    samplers: [
      wsSampler({
        name: '读取本地 fixture 聊天室',
        cmd: 'ChatRoomManager.getChatRoomWithId',
        info: {roomId: '${roomId}'},
      }),
      wsSampler({
        name: '服务端查询聊天室基础信息',
        cmd: 'ChatRoomManager.fetchChatRoomInfoFromServer',
        info: {roomId: '${roomId}'},
        children: assertStrings({
          name: '断言 fixture roomId 存在',
          scenario: 'chat-room-info-query',
          present: ['roomId'],
        }),
      }),
      wsSampler({
        name: '服务端查询聊天室成员列表',
        cmd: 'ChatRoomManager.fetchChatRoomMembers',
        infoJson: '{"roomId":"${roomId}","cursor":"${cursor}","pageSize":${pageSize}}',
        children: assertStrings({
          name: '断言 roomMemberUserId1 在聊天室成员列表中',
          scenario: 'chat-room-info-query',
          present: ['roomMemberUserId1', 'roomMemberUserId2'],
          absent: ['roomNonMemberUserId1'],
        }),
      }),
      wsSampler({
        name: '服务端查询公开聊天室',
        cmd: 'ChatRoomManager.fetchPublicChatRoomsFromServer',
        infoJson: '{"pageNum":${pageNum},"pageSize":${pageSize}}',
      }),
    ],
  },
  {
    filename: 'chat-room-member-presence.jmx',
    name: 'Chat Room Member Presence',
    variables: [],
    samplers: [
      wsSampler({
        name: '切换前退出房主',
        cmd: 'ChatClient.logout',
        info: {},
        assertSdkSuccess: false,
      }),
      loginAsSampler({
        name: '登录准备好的非成员',
        usernameVariable: 'roomNonMemberUserId1',
      }),
      wsSampler({
        name: '非成员加入聊天室',
        cmd: 'ChatRoomManager.joinChatRoomEx',
        infoJson: '{"roomId":"${roomId}","exitOtherRoom":true,"ext":"${roomExt}"}',
      }),
      wsSampler({
        name: '确认非成员已进入聊天室',
        cmd: 'ChatRoomManager.fetchChatRoomMembers',
        infoJson: '{"roomId":"${roomId}","cursor":"","pageSize":${pageSize}}',
        children: assertStrings({
          name: '断言 roomNonMemberUserId1 在成员列表中',
          scenario: 'chat-room-member-presence',
          present: ['roomNonMemberUserId1'],
        }),
      }),
      wsSampler({
        name: '非成员离开聊天室',
        cmd: 'ChatRoomManager.leaveChatRoom',
        info: {roomId: '${roomId}'},
      }),
      wsSampler({
        name: '非成员退出登录',
        cmd: 'ChatClient.logout',
        info: {},
        assertSdkSuccess: false,
      }),
      loginAsSampler({
        name: '切回房主账号',
        usernameVariable: 'roomOwnerUserId',
      }),
      wsSampler({
        name: '确认非成员已离开聊天室',
        cmd: 'ChatRoomManager.fetchChatRoomMembers',
        infoJson: '{"roomId":"${roomId}","cursor":"","pageSize":${pageSize}}',
        children: assertStrings({
          name: '断言 roomNonMemberUserId1 不在成员列表中',
          scenario: 'chat-room-member-presence',
          absent: ['roomNonMemberUserId1'],
        }),
      }),
    ],
  },
  {
    filename: 'chat-room-metadata-lifecycle.jmx',
    name: 'Chat Room Metadata Lifecycle',
    variables: [],
    samplers: [
      wsSampler({
        name: '修改聊天室名称',
        cmd: 'ChatRoomManager.changeChatRoomSubject',
        info: {roomId: '${roomId}', newName: '${roomName}'},
      }),
      wsSampler({
        name: '修改聊天室描述',
        cmd: 'ChatRoomManager.changeChatRoomDescription',
        info: {roomId: '${roomId}', newDescription: '${roomDesc}'},
      }),
      wsSampler({
        name: '更新聊天室公告',
        cmd: 'ChatRoomManager.updateChatRoomAnnouncement',
        info: {roomId: '${roomId}', announcement: '${roomAnnouncement}'},
      }),
      wsSampler({
        name: '读取聊天室公告',
        cmd: 'ChatRoomManager.fetchChatRoomAnnouncement',
        info: {roomId: '${roomId}'},
        children: assertValueEqualsVariable({
          name: '断言聊天室公告等于运行时值',
          scenario: 'chat-room-metadata-lifecycle',
          variableName: 'roomAnnouncement',
        }),
      }),
      wsSampler({
        name: '读取更新后的聊天室基础信息',
        cmd: 'ChatRoomManager.fetchChatRoomInfoFromServer',
        info: {roomId: '${roomId}'},
        children: assertStrings({
          name: '断言聊天室元数据包含运行时值',
          scenario: 'chat-room-metadata-lifecycle',
          present: ['roomId', 'roomName', 'roomDesc'],
        }),
      }),
    ],
  },
  {
    filename: 'chat-room-moderation-lifecycle.jmx',
    name: 'Chat Room Moderation Lifecycle',
    variables: [],
    samplers: [
      wsSampler({
        name: '添加聊天室管理员',
        cmd: 'ChatRoomManager.addChatRoomAdmin',
        info: {roomId: '${roomId}', admin: '${roomMemberUserId2}'},
      }),
      wsSampler({
        name: '移除聊天室管理员',
        cmd: 'ChatRoomManager.removeChatRoomAdmin',
        info: {roomId: '${roomId}', adminId: '${roomMemberUserId2}'},
      }),
      wsSampler({
        name: '禁言聊天室成员',
        cmd: 'ChatRoomManager.muteChatRoomMembers',
        infoJson: '{"roomId":"${roomId}","members":"${roomMemberUserId1}","duration":${muteDuration}}',
      }),
      wsSampler({
        name: '查询禁言列表',
        cmd: 'ChatRoomManager.fetchChatRoomMuteList',
        infoJson: '{"roomId":"${roomId}","pageNum":${pageNum},"pageSize":${pageSize}}',
        children: assertStrings({
          name: '断言 roomMemberUserId1 在禁言列表中',
          scenario: 'chat-room-moderation-lifecycle',
          present: ['roomMemberUserId1'],
        }),
      }),
      wsSampler({
        name: '解除成员禁言',
        cmd: 'ChatRoomManager.unMuteChatRoomMembers',
        info: {roomId: '${roomId}', members: '${roomMemberUserId1}'},
      }),
      wsSampler({
        name: '拉黑聊天室成员',
        cmd: 'ChatRoomManager.blockChatRoomMembers',
        info: {roomId: '${roomId}', members: '${roomMemberUserId1}'},
      }),
      wsSampler({
        name: '查询聊天室黑名单',
        cmd: 'ChatRoomManager.fetchChatRoomBlockList',
        infoJson: '{"roomId":"${roomId}","pageNum":${pageNum},"pageSize":${pageSize}}',
        children: assertStrings({
          name: '断言 roomMemberUserId1 在聊天室黑名单中',
          scenario: 'chat-room-moderation-lifecycle',
          present: ['roomMemberUserId1'],
        }),
      }),
      wsSampler({
        name: '移出聊天室黑名单',
        cmd: 'ChatRoomManager.unBlockChatRoomMembers',
        info: {roomId: '${roomId}', members: '${roomMemberUserId1}'},
      }),
      wsSampler({
        name: '加入白名单',
        cmd: 'ChatRoomManager.addMembersToChatRoomAllowList',
        info: {roomId: '${roomId}', members: '${roomMemberUserId2}'},
      }),
      wsSampler({
        name: '查询白名单',
        cmd: 'ChatRoomManager.fetchChatRoomAllowListFromServer',
        info: {roomId: '${roomId}'},
        children: assertStrings({
          name: '断言 roomMemberUserId2 在白名单中',
          scenario: 'chat-room-moderation-lifecycle',
          present: ['roomMemberUserId2'],
        }),
      }),
      wsSampler({
        name: '移出白名单',
        cmd: 'ChatRoomManager.removeMembersFromChatRoomAllowList',
        info: {roomId: '${roomId}', members: '${roomMemberUserId2}'},
      }),
    ],
  },
  {
    filename: 'chat-room-create-destroy-lifecycle.jmx',
    name: 'Chat Room Create Destroy Lifecycle',
    variables: [],
    samplers: [
      wsSampler({
        name: '创建临时聊天室',
        cmd: 'ChatRoomManager.createChatRoom',
        infoJson: '{"name":"${createdRoomName}","desc":"${createdRoomDesc}","welcomeMsg":"${roomWelcome}","members":"${roomMemberUserId1}","maxUserCount":${createdRoomMaxCount}}',
        children: extractFirstByKeys({
          name: '断言 createdRoomId 存在',
          scenario: 'chat-room-create-destroy-lifecycle',
          variableName: 'createdRoomId',
          keys: ['roomId', 'roomID', 'roomid', 'id'],
        }),
      }),
      wsSampler({
        name: '读取临时聊天室',
        cmd: 'ChatRoomManager.fetchChatRoomInfoFromServer',
        info: {roomId: '${createdRoomId}'},
        children: assertStrings({
          name: '断言临时聊天室可查询',
          scenario: 'chat-room-create-destroy-lifecycle',
          present: ['createdRoomId'],
        }),
      }),
      wsSampler({
        name: '销毁临时聊天室',
        cmd: 'ChatRoomManager.destroyChatRoom',
        info: {roomId: '${createdRoomId}'},
      }),
    ],
  },
  {
    filename: 'chat-room-attributes-lifecycle.jmx',
    name: 'Chat Room Attributes Lifecycle',
    variables: [],
    samplers: [
      wsSampler({
        name: '设置聊天室属性',
        cmd: 'ChatRoomManager.addAttributes',
        infoJson: '{"roomId":"${roomId}","attributes":[{"${roomAttributeKey}":"${roomAttributeValue}"}],"deleteWhenLeft":false,"overwrite":true}',
      }),
      wsSampler({
        name: '读取聊天室属性',
        cmd: 'ChatRoomManager.fetchChatRoomAttributes',
        info: {roomId: '${roomId}', keys: '${roomAttributeKey}'},
        children: assertStrings({
          name: '断言聊天室属性包含运行时值',
          scenario: 'chat-room-attributes-lifecycle',
          present: ['roomAttributeKey', 'roomAttributeValue'],
        }),
      }),
      wsSampler({
        name: '移除聊天室属性',
        cmd: 'ChatRoomManager.removeAttributes',
        infoJson: '{"roomId":"${roomId}","keys":"${roomAttributeKey}","forced":true}',
      }),
      wsSampler({
        name: '确认聊天室属性已移除',
        cmd: 'ChatRoomManager.fetchChatRoomAttributes',
        info: {roomId: '${roomId}', keys: '${roomAttributeKey}'},
        children: assertStrings({
          name: '断言聊天室属性已移除',
          scenario: 'chat-room-attributes-lifecycle',
          absent: ['roomAttributeValue'],
        }),
      }),
    ],
  },
];

function resultCollector(name, guiclass) {
  return `<ResultCollector guiclass="${guiclass}" testclass="ResultCollector" testname="${name}" enabled="true"><boolProp name="ResultCollector.error_logging">false</boolProp><stringProp name="filename"></stringProp></ResultCollector><hashTree/>`;
}

function listenersBlock() {
  return [
    resultCollector('View Results Tree', 'ViewResultsFullVisualizer'),
    resultCollector('Summary Report', 'SummaryReport'),
  ].join('\n        ');
}

function buildPlan(scenario) {
  const samplerXml = [
    loadFixtureSampler(),
    initSampler(),
    preCleanupLogoutSampler(),
    loginSampler(),
    installHelpersSampler(),
    ...scenario.samplers,
    logoutSampler(),
  ].join('\n        ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${xmlEscape(scenario.name)}"><boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp><elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables"><collectionProp name="Arguments.arguments"/></elementProp><boolProp name="TestPlan.functional_mode">false</boolProp><boolProp name="TestPlan.serialize_threadgroups">false</boolProp></TestPlan>
    <hashTree>
      ${argumentsBlock(scenario.variables)}
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="${xmlEscape(scenario.name)} 用例" enabled="true"><intProp name="ThreadGroup.num_threads">1</intProp><intProp name="ThreadGroup.ramp_time">1</intProp><boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp><stringProp name="ThreadGroup.on_sample_error">stopthread</stringProp><elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller"><stringProp name="LoopController.loops">1</stringProp><boolProp name="LoopController.continue_forever">false</boolProp></elementProp></ThreadGroup>
      <hashTree>
        ${samplerXml}
        ${listenersBlock()}
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
`;
}

function writePlans(plans, outputDir) {
  fs.mkdirSync(outputDir, {recursive: true});
  for (const filename of scenarioDefinitions.map(scenario => scenario.filename)) {
    fs.rmSync(path.join(outputDir, filename), {force: true});
  }
  for (const [filename, xml] of Object.entries(plans)) {
    fs.writeFileSync(path.join(outputDir, filename), xml);
  }
}

function buildAllPlans(outputDir) {
  const plans = Object.fromEntries(
    scenarioDefinitions.map(scenario => [scenario.filename, buildPlan(scenario)]),
  );

  if (outputDir !== undefined) {
    writePlans(plans, outputDir);
  }

  return plans;
}

function writeAllPlans(outputDir = defaultOutputDir) {
  const plans = buildAllPlans(outputDir);
  for (const filename of Object.keys(plans)) {
    console.log(`generated ${path.relative(process.cwd(), path.join(outputDir, filename))}`);
  }
  return plans;
}

module.exports = {
  buildAllPlans,
  buildPlan,
  scenarioDefinitions,
  xmlEscape,
  wsSampler,
  jsr223PostProcessor,
  jsr223PreProcessor,
  scriptSampler,
  setVarsSampler,
};

if (require.main === module) {
  writeAllPlans();
}
