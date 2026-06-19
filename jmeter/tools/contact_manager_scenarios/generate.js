const fs = require('node:fs');
const path = require('node:path');

const defaultOutputDir = path.resolve(__dirname, '../../data/contact-manager');

const expectedAccountKeys = [
  'APP_KEY',
  'DEFAULT_PASSWORD',
  'PRIMARY_USERNAME',
  'PRIMARY_PASSWORD',
  'CONTACT_FRIEND_USERNAME',
  'CONTACT_NON_FRIEND_USERNAME',
  'CONTACT_EXISTING_FRIEND_USERNAME',
  'CONTACT_FRIEND_TO_ADD_USERNAME',
  'CONTACT_INVITATION_SMOKE_USERNAME',
];

const expectedRelationshipKeys = [
  'APP_KEY',
  'PRIMARY_USERNAME',
  'CONTACT_FRIEND_USERNAME',
  'CONTACT_NON_FRIEND_USERNAME',
  'CONTACT_EXISTING_FRIEND_USERNAME',
  'CONTACT_FRIEND_TO_ADD_USERNAME',
  'CONTACT_INVITATION_SMOKE_USERNAME',
  'CONTACT_FIXTURE_READY',
];

const sharedFixtureKeys = [
  'APP_KEY',
  'PRIMARY_USERNAME',
  'CONTACT_FRIEND_USERNAME',
  'CONTACT_NON_FRIEND_USERNAME',
  'CONTACT_EXISTING_FRIEND_USERNAME',
  'CONTACT_FRIEND_TO_ADD_USERNAME',
  'CONTACT_INVITATION_SMOKE_USERNAME',
];

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
  ['contactFriendUserId', ''],
  ['contactNonFriendUserId', ''],
  ['contactExistingFriendUserId', ''],
  ['contactFriendToAddUserId', ''],
  ['contactInvitationSmokeUserId', ''],
  ['contactUserId', ''],
  ['targetUserId', ''],
  ['friendUserId', ''],
  ['existingNonFriendId', ''],
  ['blockedUserId', ''],
  ['addRequestTargetUserId', ''],
  ['deletePreparedContactUserId', ''],
  ['acceptTargetUserId', ''],
  ['declineTargetUserId', ''],
  ['cursor', ''],
  ['nextCursor', ''],
  ['secondPageCursor', ''],
  ['pageSize', '20'],
  ['smallPageSize', '1'],
  ['remarkValue', ''],
  ['remarkUpdatedValue', ''],
  ['remarkClearedValue', ''],
  ['addContactReason', 'contact scenario ${__time()}'],
  ['invitationReason', 'contact invitation smoke ${__time()}'],
  ['keepConversation', 'false'],
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
  if (node instanceof CharSequence) {
    out << node.toString()
    return out
  }
  if (node instanceof Map) {
    ['userId', 'username', 'name', 'id'].each { key ->
      if (node.containsKey(key) && node[key] != null) {
        out << node[key].toString()
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

def findContact
findContact = { Object node, String userId ->
  if (node == null || userId == null || userId.trim().isEmpty()) {
    return null
  }
  if (node instanceof Map) {
    if (
      [node.userId, node.username, node.name, node.id].any {
        it != null && it.toString() == userId
      }
    ) {
      return node
    }
    for (entry in node.values()) {
      def found = findContact(entry, userId)
      if (found != null) {
        return found
      }
    }
  }
  if (node instanceof List) {
    for (entry in node) {
      def found = findContact(entry, userId)
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
    failPrecondition(scenario, "requires \${variableName} from fixture env")
    return null
  }
  return value
}

vars.putObject('contactScenarioParseResponse', parseResponse)
vars.putObject('contactScenarioResponseValue', responseValue)
vars.putObject('contactScenarioFlattenStrings', flattenStrings)
vars.putObject('contactScenarioFindContact', findContact)
vars.putObject('contactScenarioRequireValue', requireValue)
vars.putObject('contactScenarioFailPrecondition', failPrecondition)
`;

const loadFixtureScript = `import java.nio.file.Files
import java.nio.file.Paths

def scenario = 'ContactManager fixture loader'
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
vars.put('username', props.get('username') ?: accounts.PRIMARY_USERNAME)
vars.put('password', props.get('password') ?: accounts.PRIMARY_PASSWORD)
vars.put('defaultPassword', accounts.DEFAULT_PASSWORD)
vars.put('primaryUserId', accounts.PRIMARY_USERNAME)
vars.put('contactFriendUserId', accounts.CONTACT_FRIEND_USERNAME)
vars.put('contactNonFriendUserId', accounts.CONTACT_NON_FRIEND_USERNAME)
vars.put('contactExistingFriendUserId', accounts.CONTACT_EXISTING_FRIEND_USERNAME)
vars.put('contactFriendToAddUserId', accounts.CONTACT_FRIEND_TO_ADD_USERNAME)
vars.put('contactInvitationSmokeUserId', accounts.CONTACT_INVITATION_SMOKE_USERNAME)
vars.put('contactUserId', accounts.CONTACT_FRIEND_USERNAME)
result.setResponseData('CONTACT_FIXTURE_READY=true', 'UTF-8')
`;

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function rawJson(value) {
  return {__rawJson: String(value)};
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

function logoutSampler() {
  return wsSampler({
    name: '退出登录',
    cmd: 'ChatClient.logout',
    info: {},
    assertSdkSuccess: false,
  });
}

function installHelpersSampler() {
  return jsr223PreProcessor('安装 ContactManager 场景工具方法', helperScript);
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
  const presentJson = JSON.stringify(present);
  const absentJson = JSON.stringify(absent);
  return groovyAssert(
    name,
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
def strings = flattenStrings(value) as Set
def presentVars = ${presentJson}
presentVars.each { variableName ->
  def expected = vars.get(variableName)
  if (expected == null || expected.trim().isEmpty() || !strings.contains(expected)) {
    failPrecondition('${scenario}', 'expected ' + variableName + ' to appear in response')
  }
}
def absentVars = ${absentJson}
absentVars.each { variableName ->
  def unexpected = vars.get(variableName)
  if (unexpected != null && unexpected.trim() && strings.contains(unexpected)) {
    failPrecondition('${scenario}', 'expected ' + variableName + ' to be absent from response')
  }
}`,
  );
}

function assertContactObject({name, scenario, variableName, remarkVar, allowMissing = false, allowClearedRemark = false}) {
  const elseLines = [];
  if (remarkVar) {
    elseLines.push(`def expectedRemark = vars.get('${remarkVar}')
  if (contact.remark?.toString() != expectedRemark) {
    failPrecondition('${scenario}', 'expected remark from ${remarkVar}')
  }`);
  }
  if (allowClearedRemark) {
    elseLines.push(`if (contact.containsKey('remark') && contact.remark != null && contact.remark.toString() != '') {
    failPrecondition('${scenario}', 'expected cleared remark representation')
  }`);
  }
  if (elseLines.length === 0) {
    elseLines.push('// contact object exists');
  }

  return groovyAssert(
    name,
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
def userId = requireValue('${scenario}', '${variableName}')
if (!prev.isSuccessful()) {
  return
}
def contact = findContact(value, userId)
if (contact == null) {
  ${allowMissing ? 'return' : `failPrecondition('${scenario}', 'requires contact object for ${variableName}')`}
} else {
  ${elseLines.join('\n  ')}
}`,
  );
}

function assertContactObjects({name, scenario, variableNames}) {
  return groovyAssert(
    name,
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
def variableNames = ${JSON.stringify(variableNames)}
variableNames.each { variableName ->
  def userId = requireValue('${scenario}', variableName)
  if (!prev.isSuccessful()) {
    return
  }
  if (findContact(value, userId) == null) {
    failPrecondition('${scenario}', 'requires contact object for ' + variableName)
  }
}`,
  );
}

function assertListShape({name}) {
  return groovyAssert(
    name,
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
if (!(value instanceof List) && !(value instanceof Map)) {
  prev.setSuccessful(false)
  prev.setResponseCode('ASSERTION_FAILED')
  prev.setResponseMessage('expected list-like ContactManager response')
}`,
  );
}

function assertCursorPage({name, scenario, pageSizeVariable, storeCursor, storeFirstUser}) {
  return groovyAssert(
    name,
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
if (!(value instanceof Map) || !(value.list instanceof List) || !value.containsKey('cursor')) {
  failPrecondition('${scenario}', 'requires cursor page response with list and cursor')
  return
}
def maxSize = (vars.get('${pageSizeVariable}') ?: '0') as Integer
if (value.list.size() > maxSize) {
  prev.setSuccessful(false)
  prev.setResponseCode('ASSERTION_FAILED')
  prev.setResponseMessage('page size exceeded ${pageSizeVariable}')
}
vars.put('${storeCursor}', value.cursor == null ? '' : value.cursor.toString())
${storeFirstUser ? `if (!value.list.isEmpty()) {
  def strings = flattenStrings(value.list[0])
  vars.put('${storeFirstUser}', strings.isEmpty() ? '' : strings[0])
}` : ''}`,
  );
}

function assertSecondPageAdvances() {
  return groovyAssert(
    '断言第二页游标推进',
    `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
if (!(value instanceof Map) || !(value.list instanceof List) || !value.containsKey('cursor')) {
  failPrecondition('contact-pagination-cursor', 'requires second cursor page response')
  return
}
if (value.list.size() > ((vars.get('smallPageSize') ?: '0') as Integer)) {
  prev.setSuccessful(false)
  prev.setResponseCode('ASSERTION_FAILED')
  prev.setResponseMessage('second page size exceeded smallPageSize')
}
if (!value.list.isEmpty()) {
  def strings = flattenStrings(value.list[0])
  def first = strings.isEmpty() ? '' : strings[0]
  if (first && first == vars.get('firstSmallPageUserId')) {
    prev.setSuccessful(false)
    prev.setResponseCode('ASSERTION_FAILED')
    prev.setResponseMessage('second page repeated first page user id')
  }
}
vars.put('secondPageCursor', value.cursor == null ? '' : value.cursor.toString())`,
  );
}

function ifVarNonEmpty(variableName, children) {
  const escapedVariableName = xmlEscape(variableName);
  const condition = `\${__groovy(vars.get('${escapedVariableName}') != null &amp;&amp; vars.get('${escapedVariableName}').trim().length() &gt; 0,)}`;
  return `<IfController guiclass="IfControllerPanel" testclass="IfController" testname="仅当 ${escapedVariableName} 非空时执行" enabled="true"><stringProp name="IfController.condition">${condition}</stringProp><boolProp name="IfController.evaluateAll">false</boolProp><boolProp name="IfController.useExpression">true</boolProp></IfController>
        <hashTree>${children}</hashTree>`;
}

function resultCollector(name, guiclass) {
  return `<ResultCollector guiclass="${guiclass}" testclass="ResultCollector" testname="${name}" enabled="true"><boolProp name="ResultCollector.error_logging">false</boolProp><stringProp name="filename"></stringProp></ResultCollector><hashTree/>`;
}

function listenersBlock() {
  return [
    resultCollector('View Results Tree', 'ViewResultsFullVisualizer'),
    resultCollector('Summary Report', 'SummaryReport'),
  ].join('\n        ');
}

const scenarioDefinitions = [
  {
    filename: 'contact-list-query.jmx',
    name: 'Contact List Discovery And Query',
    variables: [],
    samplers: [
      setVarsSampler('设置联系人查询目标', {contactUserId: '${contactFriendUserId}'}),
      wsSampler({
        name: '服务端联系人列表查询',
        cmd: 'ChatContactManager.getAllContactsFromServer',
        children: assertStrings({
          name: '断言服务端联系人基线',
          scenario: 'contact-list-query',
          present: ['contactFriendUserId', 'contactExistingFriendUserId'],
          absent: ['contactNonFriendUserId', 'contactFriendToAddUserId'],
        }),
      }),
      wsSampler({
        name: '拉取服务端联系人对象',
        cmd: 'ChatContactManager.fetchAllContacts',
        children: assertContactObjects({
          name: '断言两个准备联系人对象存在',
          scenario: 'contact-list-query',
          variableNames: ['contactFriendUserId', 'contactExistingFriendUserId'],
        }),
      }),
      wsSampler({
        name: '读取本地 DB 联系人字符串列表',
        cmd: 'ChatContactManager.getAllContactsFromDB',
        children: assertListShape({name: '断言本地 DB 返回列表形态'}),
      }),
      wsSampler({
        name: '读取本地联系人对象列表',
        cmd: 'ChatContactManager.getAllContacts',
        children: assertListShape({name: '断言本地对象返回列表形态'}),
      }),
      wsSampler({
        name: '读取单个本地联系人',
        cmd: 'ChatContactManager.getContact',
        info: {username: '${contactUserId}'},
        children: assertContactObject({
          name: '断言单联系人 userId 可选匹配',
          scenario: 'contact-list-query',
          variableName: 'contactUserId',
          allowMissing: true,
        }),
      }),
    ],
  },
  {
    filename: 'contact-remark-lifecycle.jmx',
    name: 'Contact Remark Lifecycle',
    variables: [
      ['remarkValue', 'jmeter-remark-${__time()}'],
      ['remarkUpdatedValue', 'jmeter-remark-updated-${__time()}'],
      ['remarkClearedValue', ''],
    ],
    samplers: [
      setVarsSampler('设置备注联系人目标', {contactUserId: '${contactFriendUserId}'}),
      wsSampler({
        name: '确认备注目标联系人存在',
        cmd: 'ChatContactManager.fetchAllContacts',
        children: assertContactObject({
          name: '断言备注目标存在',
          scenario: 'contact-remark-lifecycle',
          variableName: 'contactUserId',
        }),
      }),
      wsSampler({
        name: '设置联系人备注',
        cmd: 'ChatContactManager.setContactRemark',
        info: {username: '${contactUserId}', remark: '${remarkValue}'},
      }),
      wsSampler({
        name: '校验联系人备注已设置',
        cmd: 'ChatContactManager.fetchAllContacts',
        children: assertContactObject({
          name: '断言备注值已设置',
          scenario: 'contact-remark-lifecycle',
          variableName: 'contactUserId',
          remarkVar: 'remarkValue',
        }),
      }),
      wsSampler({
        name: '更新联系人备注',
        cmd: 'ChatContactManager.setContactRemark',
        info: {username: '${contactUserId}', remark: '${remarkUpdatedValue}'},
      }),
      wsSampler({
        name: '校验联系人备注已更新',
        cmd: 'ChatContactManager.fetchAllContacts',
        children: assertContactObject({
          name: '断言备注值已更新',
          scenario: 'contact-remark-lifecycle',
          variableName: 'contactUserId',
          remarkVar: 'remarkUpdatedValue',
        }),
      }),
      wsSampler({
        name: '读取单个联系人备注目标',
        cmd: 'ChatContactManager.getContact',
        info: {username: '${contactUserId}'},
        children: assertContactObject({
          name: '断言单联系人可选存在',
          scenario: 'contact-remark-lifecycle',
          variableName: 'contactUserId',
          allowMissing: true,
        }),
      }),
      wsSampler({
        name: '清空联系人备注',
        cmd: 'ChatContactManager.setContactRemark',
        info: {username: '${contactUserId}', remark: '${remarkClearedValue}'},
      }),
      wsSampler({
        name: '校验联系人备注已清空',
        cmd: 'ChatContactManager.fetchAllContacts',
        children: assertContactObject({
          name: '断言备注已清空',
          scenario: 'contact-remark-lifecycle',
          variableName: 'contactUserId',
          allowClearedRemark: true,
        }),
      }),
    ],
  },
  {
    filename: 'contact-add-request-prepared-delete.jmx',
    name: 'Contact Add Request Path And Prepared Delete Path',
    variables: [['keepConversation', 'false']],
    samplers: [
      setVarsSampler('设置添加和删除目标', {
        addRequestTargetUserId: '${contactFriendToAddUserId}',
        deletePreparedContactUserId: '${contactExistingFriendUserId}',
      }),
      wsSampler({
        name: '发送添加联系人请求',
        cmd: 'ChatContactManager.addContact',
        info: {username: '${addRequestTargetUserId}', reason: '${addContactReason}'},
      }),
      wsSampler({
        name: '删除预置联系人',
        cmd: 'ChatContactManager.deleteContact',
        infoJson: '{"username":"${deletePreparedContactUserId}","keepConversation":${keepConversation}}',
      }),
    ],
  },
  {
    filename: 'contact-invitation-request-path-smoke.jmx',
    name: 'Contact Invitation Request Path Smoke',
    variables: [],
    samplers: [
      setVarsSampler('设置邀请 smoke 目标', {
        acceptTargetUserId: '${contactInvitationSmokeUserId}',
        declineTargetUserId: '${contactNonFriendUserId}',
      }),
      wsSampler({
        name: '接受邀请请求路径 smoke',
        cmd: 'ChatContactManager.acceptInvitation',
        info: {username: '${acceptTargetUserId}'},
        assertSdkSuccess: false,
      }),
      wsSampler({
        name: '拒绝邀请请求路径 smoke',
        cmd: 'ChatContactManager.declineInvitation',
        info: {username: '${declineTargetUserId}'},
        assertSdkSuccess: false,
      }),
      wsSampler({
        name: '已存在好友输入类接受邀请 smoke',
        cmd: 'ChatContactManager.acceptInvitation',
        info: {username: '${contactFriendUserId}'},
        assertSdkSuccess: false,
      }),
    ],
  },
  {
    filename: 'contact-block-list-lifecycle.jmx',
    name: 'Block List Lifecycle',
    variables: [],
    samplers: [
      setVarsSampler('设置黑名单目标', {blockedUserId: '${contactNonFriendUserId}'}),
      wsSampler({
        name: '添加用户到黑名单',
        cmd: 'ChatContactManager.addUserToBlockList',
        info: {username: '${blockedUserId}'},
      }),
      wsSampler({
        name: '服务端黑名单查询-添加后',
        cmd: 'ChatContactManager.getBlockListFromServer',
        children: assertStrings({
          name: '断言 blockedUserId 在服务端黑名单中',
          scenario: 'contact-block-list-lifecycle',
          present: ['blockedUserId'],
        }),
      }),
      wsSampler({
        name: '从黑名单移除用户',
        cmd: 'ChatContactManager.removeUserFromBlockList',
        info: {username: '${blockedUserId}'},
      }),
      wsSampler({
        name: '服务端黑名单查询-移除后',
        cmd: 'ChatContactManager.getBlockListFromServer',
        children: assertStrings({
          name: '断言 blockedUserId 不在服务端黑名单中',
          scenario: 'contact-block-list-lifecycle',
          absent: ['blockedUserId'],
        }),
      }),
    ],
  },
  {
    filename: 'contact-pagination-cursor.jmx',
    name: 'Pagination And Cursor Behavior',
    variables: [
      ['pageSize', '20'],
      ['smallPageSize', '1'],
      ['firstSmallPageUserId', ''],
    ],
    samplers: [
      wsSampler({
        name: '分页拉取联系人默认页',
        cmd: 'ChatContactManager.fetchContacts',
        infoJson: '{"cursor":"${cursor}","pageSize":${pageSize}}',
        children: assertCursorPage({
          name: '断言默认页游标响应',
          scenario: 'contact-pagination-cursor',
          pageSizeVariable: 'pageSize',
          storeCursor: 'cursor',
        }),
      }),
      wsSampler({
        name: '分页拉取联系人小页',
        cmd: 'ChatContactManager.fetchContacts',
        infoJson: '{"cursor":"","pageSize":${smallPageSize}}',
        children: assertCursorPage({
          name: '断言小页游标响应并保存 nextCursor',
          scenario: 'contact-pagination-cursor',
          pageSizeVariable: 'smallPageSize',
          storeCursor: 'nextCursor',
          storeFirstUser: 'firstSmallPageUserId',
        }),
      }),
      ifVarNonEmpty('nextCursor', wsSampler({
        name: '分页拉取联系人第二页',
        cmd: 'ChatContactManager.fetchContacts',
        infoJson: '{"cursor":"${nextCursor}","pageSize":${smallPageSize}}',
        children: assertSecondPageAdvances(),
      })),
      ifVarNonEmpty('secondPageCursor', wsSampler({
        name: '分页拉取联系人可选第三页',
        cmd: 'ChatContactManager.fetchContacts',
        infoJson: '{"cursor":"${secondPageCursor}","pageSize":${smallPageSize}}',
        children: assertCursorPage({
          name: '断言可选第三页游标响应',
          scenario: 'contact-pagination-cursor',
          pageSizeVariable: 'smallPageSize',
          storeCursor: 'secondPageCursor',
        }),
      })),
    ],
  },
  {
    filename: 'contact-self-platform-smoke.jmx',
    name: 'Self Platform Smoke',
    variables: [],
    samplers: [
      wsSampler({
        name: '查询其他平台自己的 ID',
        cmd: 'ChatContactManager.getSelfIdsOnOtherPlatform',
        children: groovyAssert(
          '断言其他平台 ID 列表形态',
          `def value = responseValue()
if (!prev.isSuccessful()) {
  return
}
if (value instanceof List) {
  value.each { item ->
    if (item == null || item.toString().trim().isEmpty()) {
      prev.setSuccessful(false)
      prev.setResponseCode('ASSERTION_FAILED')
      prev.setResponseMessage('self platform id list contains empty item')
    }
  }
}`,
        ),
      }),
    ],
  },
];

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
  ifVarNonEmpty,
  rawJson,
};

if (require.main === module) {
  writeAllPlans();
}
