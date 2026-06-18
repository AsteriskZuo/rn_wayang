const fs = require('node:fs');
const path = require('node:path');

const defaultOutputDir = path.resolve(__dirname, '../../data/chat-manager');
let cachedScenarioDefinitions;

const baseVariables = [
  ['url', '${__P(url,localhost)}'],
  ['port', '${__P(port,8083)}'],
  ['timeout', '${__P(timeout,10000)}'],
  ['topic', '${__P(topic,rn)}'],
  ['appKey', '${__P(appKey,1135220126133718#demo)}'],
  ['username', '${__P(username,asterisk001)}'],
  ['password', '${__P(password,qwerty)}'],
  ['contactUserId', ''],
  ['conversationId', ''],
  ['conversationType', 'PeerChat'],
  ['messageId', ''],
  ['messageIds', ''],
  ['groupId', ''],
  ['roomId', ''],
  ['threadId', ''],
  ['cursor', ''],
  ['pageSize', '20'],
  ['count', '20'],
  ['direction', 'UP'],
  ['isChatThread', 'false'],
  ['languages', 'en'],
  ['convIds', ''],
  ['msgTypes', 'txt,img'],
  ['body', '{}'],
  ['dict', '{}'],
  ['options', '{}'],
];

const scenarioToolsScript = `import groovy.json.JsonOutput
import groovy.json.JsonSlurper

def parseResponse = {
  new JsonSlurper().parseText(prev.getResponseDataAsString())
}

def failPrecondition = { String scenario, String variableName, String reason ->
  def message = "PRECONDITION_FAILED: \${scenario} requires \${variableName}, but \${reason}"
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

def findFirstString
findFirstString = { Object node, List names ->
  if (node == null) {
    return null
  }
  if (node instanceof CharSequence && node.toString().trim()) {
    return node.toString()
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
    prev.setResponseMessage("\${scenario} expected top-level ok=true")
  }
  return root
}

vars.putObject('chatManagerScenarioParseResponse', parseResponse)
vars.putObject('chatManagerScenarioFailPrecondition', failPrecondition)
vars.putObject('chatManagerScenarioRequireString', requireString)
vars.putObject('chatManagerScenarioFindFirstString', findFirstString)
vars.putObject('chatManagerScenarioAssertOk', assertOk)
vars.putObject('chatManagerScenarioToolsInstalled', true)
`;

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function argument(name, value) {
  return `<elementProp name="${xmlEscape(name)}" elementType="Argument"><stringProp name="Argument.name">${xmlEscape(name)}</stringProp><stringProp name="Argument.value">${xmlEscape(value)}</stringProp><stringProp name="Argument.metadata">=</stringProp></elementProp>`;
}

function mergeVariables(extraVariables = []) {
  const variables = new Map(baseVariables);
  for (const entry of extraVariables) {
    if (Array.isArray(entry)) {
      variables.set(entry[0], entry[1]);
    } else if (entry && typeof entry === 'object') {
      variables.set(entry.name, entry.value);
    }
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

function sdkSuccessAssertion({allowedErrors = []} = {}) {
  const allowedErrorsScript = JSON.stringify(allowedErrors)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'");

  return jsr223PostProcessor(
    '断言 SDK 未返回明显错误',
    `import groovy.json.JsonSlurper

def allowedErrors = new JsonSlurper().parseText('${allowedErrorsScript}')

def rawResponse = prev.getResponseDataAsString()
if (rawResponse == null || rawResponse.trim().isEmpty()) {
  return
}

def root = new JsonSlurper().parseText(rawResponse)
def value = root instanceof Map ? root.value : null
def isAllowedError = { Object errorValue ->
  if (!(errorValue instanceof Map)) {
    return false
  }
  return allowedErrors.any { allowed ->
    def codeMatches = !allowed.containsKey('code') || errorValue.code?.toString() == allowed.code?.toString()
    def descriptionMatches = !allowed.containsKey('description') || errorValue.description?.toString() == allowed.description?.toString()
    return codeMatches && descriptionMatches
  }
}

if (
  value instanceof Map &&
  value.containsKey('code') &&
  value.containsKey('description') &&
  !isAllowedError(value)
) {
  prev.setSuccessful(false)
  prev.setResponseCode('SDK_ERROR')
  prev.setResponseMessage('SDK returned ChatError-like value: ' + value.toString())
}`,
  );
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

  return stringifyJsonWithRaw(
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
  );
}

function wsSampler({
  name,
  cmd,
  info,
  infoJson,
  newConnection = false,
  readTimeout = '${timeout}',
  enabled = true,
  children = '',
  assertOk = true,
  assertSdkSuccess = true,
  allowedSdkErrors = [],
}) {
  const requestData = xmlEscape(requestJson(cmd, info, infoJson));
  const connectionProps = newConnection
    ? '<boolProp name="createNewConnection">true</boolProp><boolProp name="TLS">false</boolProp><stringProp name="server">${url}</stringProp><stringProp name="port">${port}</stringProp><stringProp name="path">/iov/websocket/dual?topic=${topic}</stringProp><stringProp name="connectTimeout">${timeout}</stringProp>'
    : '<boolProp name="createNewConnection">false</boolProp><boolProp name="TLS">false</boolProp><stringProp name="server"></stringProp><stringProp name="port">80</stringProp><stringProp name="path"></stringProp>';
  const assertion = assertOk ? okAssertion() : '';
  const sdkAssertion =
    assertOk && assertSdkSuccess
      ? sdkSuccessAssertion({allowedErrors: allowedSdkErrors})
      : '';

  return `<eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler guiclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSamplerGui" testclass="eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler" testname="${xmlEscape(name)}" enabled="${enabled ? 'true' : 'false'}">${connectionProps}<boolProp name="binaryPayload">false</boolProp><stringProp name="requestData">${requestData}</stringProp><stringProp name="readTimeout">${xmlEscape(readTimeout)}</stringProp><boolProp name="loadDataFromFile">false</boolProp><stringProp name="dataFile"></stringProp></eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler>
        <hashTree>${assertion}${sdkAssertion}${children}</hashTree>`;
}

function jsr223PostProcessor(name, script) {
  return `<JSR223PostProcessor guiclass="TestBeanGUI" testclass="JSR223PostProcessor" testname="${xmlEscape(name)}" enabled="true"><stringProp name="cacheKey">true</stringProp><stringProp name="filename"></stringProp><stringProp name="parameters"></stringProp><stringProp name="script">${xmlEscape(script)}</stringProp><stringProp name="scriptLanguage">groovy</stringProp></JSR223PostProcessor><hashTree/>`;
}

function jsr223PreProcessor(name, script) {
  return `<JSR223PreProcessor guiclass="TestBeanGUI" testclass="JSR223PreProcessor" testname="${xmlEscape(name)}" enabled="true"><stringProp name="cacheKey">true</stringProp><stringProp name="filename"></stringProp><stringProp name="parameters"></stringProp><stringProp name="script">${xmlEscape(script)}</stringProp><stringProp name="scriptLanguage">groovy</stringProp></JSR223PreProcessor><hashTree/>`;
}

function scriptSampler(name, script, { enabled = true } = {}) {
  return `<JSR223Sampler guiclass="TestBeanGUI" testclass="JSR223Sampler" testname="${xmlEscape(name)}" enabled="${enabled ? 'true' : 'false'}"><stringProp name="cacheKey">true</stringProp><stringProp name="filename"></stringProp><stringProp name="parameters"></stringProp><stringProp name="script">${xmlEscape(script)}</stringProp><stringProp name="scriptLanguage">groovy</stringProp></JSR223Sampler><hashTree/>`;
}

function initSampler() {
  return wsSampler({
    name: '初始化',
    cmd: 'ChatClient.init',
    newConnection: true,
    info: {appKey: '${appKey}', autoLogin: false, debugModel: true},
  });
}

function loginSampler() {
  return wsSampler({
    name: '登录',
    cmd: 'ChatClient.login',
    readTimeout: '60000',
    info: {username: '${username}', password: '${password}'},
    allowedSdkErrors: [
      {
        code: 200,
        description: 'The user is already logged in',
      },
    ],
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

function logoutSampler() {
  return wsSampler({
    name: '退出登录',
    cmd: 'ChatClient.logout',
    info: {},
  });
}

function helperScript(script) {
  return `${scenarioToolsScript}
${script}`;
}

function setVarsSampler(name, variables) {
  const script = Object.entries(variables)
    .map(([key, value]) => `vars.put('${key}', '${String(value).replaceAll("'", "\\'")}')`)
    .join('\n');
  return scriptSampler(name, script);
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

function getScenarioDefinitions() {
  if (cachedScenarioDefinitions === undefined) {
    cachedScenarioDefinitions = require('./scenarios');
  }
  return cachedScenarioDefinitions;
}

function failFastExtractionScript({scenarioName, variableName, source, names, onFound = ''}) {
  const groovyNames = names.map(name => `'${name}'`).join(', ');
  return helperScript(`if (!prev.isSuccessful()) {
  return
}
def rawResponse = prev.getResponseDataAsString()
if (rawResponse == null || rawResponse.trim().isEmpty()) {
  return
}
def root = new JsonSlurper().parseText(rawResponse)
def found = findFirstString(root.value, [${groovyNames}])
if (found == null) {
  def message = 'PRECONDITION_FAILED: ${scenarioName} requires ${variableName}, but ${source}'
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
} else {
  vars.put('${variableName}', found)
${onFound}
}`);
}

function discoverContactSampler(scenarioName) {
  return wsSampler({
    name: '发现联系人',
    cmd: 'ChatContactManager.getAllContactsFromServer',
    info: {},
    children: jsr223PostProcessor(
      '提取 contactUserId',
      failFastExtractionScript({
        scenarioName,
        variableName: 'contactUserId',
        source: 'ChatContactManager.getAllContactsFromServer returned no usable contact',
        names: ['userId', 'userId_1', 'username', 'name'],
        onFound: "  vars.put('conversationId', found)\n  vars.put('conversationType', 'PeerChat')\n  vars.put('convIds', found)",
      }),
    ),
  });
}

function discoverGroupSampler(scenarioName, variableName = 'groupId') {
  return wsSampler({
    name: '发现已加入群组',
    cmd: 'ChatGroupManager.getJoinedGroups',
    info: {},
    children: jsr223PostProcessor(
      `提取 ${variableName}`,
      failFastExtractionScript({
        scenarioName,
        variableName,
        source: 'ChatGroupManager.getJoinedGroups returned no joined group',
        names: ['groupId', 'groupID', 'id'],
        onFound: "  vars.put('groupId', found)",
      }),
    ),
  });
}

function discoverRoomSampler(scenarioName) {
  return wsSampler({
    name: '发现公开聊天室',
    cmd: 'ChatRoomManager.fetchPublicChatRoomsFromServer',
    info: {pageNum: 1, pageSize: rawJson('${pageSize}')},
    children: jsr223PostProcessor(
      '提取 roomId',
      failFastExtractionScript({
        scenarioName,
        variableName: 'roomId',
        source: 'ChatRoomManager.fetchPublicChatRoomsFromServer returned no public room',
        names: ['roomId', 'id'],
      }),
    ),
  });
}

function sendMessageSampler({
  name = '发送消息',
  scenarioName,
  info,
  infoJson,
  variableName = 'messageId',
  children = '',
} = {}) {
  const extraction = scenarioName
    ? jsr223PostProcessor(
        `提取 ${variableName}`,
        failFastExtractionScript({
          scenarioName,
          variableName,
          source: 'ChatManager.sendMessage returned no message id',
          names: ['msgId', 'messageId', 'id'],
          onFound: "  vars.put('messageId', found)\n  vars.put('messageIds', found)",
        }),
      )
    : '';

  return wsSampler({
    name,
    cmd: 'ChatManager.sendMessage',
    info,
    infoJson,
    children: `${extraction}${children}`,
  });
}

function buildPlan(scenario) {
  const samplerXml = [
    initSampler(),
    preCleanupLogoutSampler(),
    loginSampler(),
    jsr223PreProcessor('安装场景工具方法', scenarioToolsScript),
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
  for (const [filename, xml] of Object.entries(plans)) {
    const target = path.join(outputDir, filename);
    fs.writeFileSync(target, xml);
  }
}

function buildAllPlans(outputDir) {
  const plans = Object.fromEntries(
    getScenarioDefinitions().map(scenario => [
      scenario.filename,
      buildPlan(scenario),
    ]),
  );

  if (outputDir !== undefined) {
    writePlans(plans, outputDir);
  }

  return plans;
}

function writeAllPlans(outputDir = defaultOutputDir) {
  const plans = buildAllPlans(outputDir);
  for (const filename of Object.keys(plans)) {
    const target = path.join(outputDir, filename);
    console.log(`generated ${path.relative(process.cwd(), target)}`);
  }
  return plans;
}

module.exports = {
  buildAllPlans,
  buildPlan,
  get scenarioDefinitions() {
    return getScenarioDefinitions();
  },
  xmlEscape,
  wsSampler,
  jsr223PostProcessor,
  jsr223PreProcessor,
  discoverContactSampler,
  discoverGroupSampler,
  discoverRoomSampler,
  sendMessageSampler,
  scriptSampler,
  setVarsSampler,
  rawJson,
};

if (require.main === module) {
  writeAllPlans();
}
