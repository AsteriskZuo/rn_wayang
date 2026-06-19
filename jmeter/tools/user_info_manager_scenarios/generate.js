const fs = require('node:fs');
const path = require('node:path');

const defaultOutputDir = path.resolve(__dirname, '../../data/user-info-manager');

const expectedAccountKeys = [
  'APP_KEY',
  'DEFAULT_PASSWORD',
  'PRIMARY_USERNAME',
  'PRIMARY_PASSWORD',
  'CONTACT_FRIEND_USERNAME',
  'CHAT_PEER_USERNAME',
  'GROUP_OWNER_USERNAME',
  'ROOM_OWNER_USERNAME',
];

const expectedRelationshipKeys = [
  'APP_KEY',
  'PRIMARY_USERNAME',
  'CONTACT_FIXTURE_READY',
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
  ['contactFriendUserId', ''],
  ['chatPeerUserId', ''],
  ['groupOwnerUserId', ''],
  ['roomOwnerUserId', ''],
  ['queryUserIds', ''],
  ['nickName', 'jmeter-user-info-${__time()}'],
  ['avatarUrl', 'https://example.invalid/jmeter-user-info-${__time()}.png'],
  ['email', 'jmeter-user-info-${__time()}@example.invalid'],
  ['phone', '1550000${__Random(1000,9999)}'],
  ['gender', '1'],
  ['sign', 'jmeter user info sign ${__time()}'],
  ['birth', '1990-01-01'],
  ['ext', 'jmeter-user-info-ext-${__time()}'],
];

const helperScript = `import groovy.json.JsonSlurper

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
    ['userId', 'username', 'userName', 'nickName', 'avatarUrl', 'mail', 'email', 'phone', 'gender', 'sign', 'birth', 'ext', 'id', 'name'].each { key ->
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

def requireValue = { String scenario, String variableName ->
  def value = vars.get(variableName)
  if (value == null || value.trim().isEmpty()) {
    failPrecondition(scenario, "requires \${variableName} from fixture env or previous sampler")
    return null
  }
  return value
}

vars.putObject('userInfoScenarioParseResponse', parseResponse)
vars.putObject('userInfoScenarioResponseValue', responseValue)
vars.putObject('userInfoScenarioFlattenStrings', flattenStrings)
vars.putObject('userInfoScenarioRequireValue', requireValue)
vars.putObject('userInfoScenarioFailPrecondition', failPrecondition)
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
vars.put('username', props.get('username') ?: accounts.PRIMARY_USERNAME)
vars.put('password', props.get('password') ?: accounts.PRIMARY_PASSWORD)
vars.put('defaultPassword', accounts.DEFAULT_PASSWORD)
vars.put('primaryUserId', accounts.PRIMARY_USERNAME)
vars.put('contactFriendUserId', accounts.CONTACT_FRIEND_USERNAME)
vars.put('chatPeerUserId', accounts.CHAT_PEER_USERNAME)
vars.put('groupOwnerUserId', accounts.GROUP_OWNER_USERNAME)
vars.put('roomOwnerUserId', accounts.ROOM_OWNER_USERNAME)
vars.put('queryUserIds', accounts.PRIMARY_USERNAME + ',' + accounts.CONTACT_FRIEND_USERNAME + ',' + accounts.CHAT_PEER_USERNAME)
result.setResponseData('CONTACT_FIXTURE_READY=true PRIMARY_USERNAME=' + accounts.PRIMARY_USERNAME, 'UTF-8')
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

function logoutSampler() {
  return wsSampler({
    name: '退出登录',
    cmd: 'ChatClient.logout',
    info: {},
    assertSdkSuccess: false,
  });
}

function installHelpersSampler() {
  return jsr223PreProcessor('安装 ChatUserInfoManager 场景工具方法', helperScript);
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

const scenarioDefinitions = [
  {
    filename: 'user-info-own-query.jmx',
    name: 'User Info Own Query',
    variables: [],
    samplers: [
      wsSampler({
        name: '查询自己的用户信息',
        cmd: 'ChatUserInfoManager.fetchOwnInfo',
        info: {},
        children: assertStrings({
          name: '断言 primaryUserId 存在于自己的用户信息',
          scenario: 'user-info-own-query',
          present: ['primaryUserId'],
        }),
      }),
    ],
  },
  {
    filename: 'user-info-batch-query.jmx',
    name: 'User Info Batch Query',
    variables: [],
    samplers: [
      wsSampler({
        name: '按 ID 批量查询 fixture 用户信息',
        cmd: 'ChatUserInfoManager.fetchUserInfoById',
        infoJson: '{"ids":"${queryUserIds}"}',
        children: assertStrings({
          name: '断言批量用户信息包含 fixture 用户',
          scenario: 'user-info-batch-query',
          present: ['primaryUserId', 'contactFriendUserId', 'chatPeerUserId'],
        }),
      }),
    ],
  },
  {
    filename: 'user-info-update-lifecycle.jmx',
    name: 'User Info Update Lifecycle',
    variables: [],
    samplers: [
      wsSampler({
        name: '更新自己的用户信息',
        cmd: 'ChatUserInfoManager.updateOwnUserInfo',
        infoJson: '{"nickName":"${nickName}","avatarUrl":"${avatarUrl}","email":"${email}","phone":"${phone}","gender":${gender},"sign":"${sign}","birth":"${birth}","ext":"${ext}"}',
      }),
      wsSampler({
        name: '读取更新后的自己的用户信息',
        cmd: 'ChatUserInfoManager.fetchOwnInfo',
        info: {},
        children: assertStrings({
          name: '断言自己的用户信息包含运行时更新值',
          scenario: 'user-info-update-lifecycle',
          present: ['primaryUserId', 'nickName', 'avatarUrl', 'email', 'phone', 'sign', 'birth', 'ext'],
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
};

if (require.main === module) {
  writeAllPlans();
}
