const scenarioName = 'message-send-types';

function getScenarioTools() {
  const {
    discoverContactSampler,
    sendMessageSampler,
    wsSampler,
    jsr223PostProcessor,
  } = require('../generate');

  return {
    discoverContactSampler,
    sendMessageSampler,
    wsSampler,
    jsr223PostProcessor,
  };
}

function idVariable(variableName) {
  return `\${${variableName}}`;
}

function assertMessageIdPostProcessor(label, variableName) {
  const {jsr223PostProcessor} = getScenarioTools();

  return jsr223PostProcessor(
    `断言 ${label} getMessage 返回同一 id`,
    `def expected = vars.get('${variableName}')
def body = prev.getResponseDataAsString()
if (expected == null || expected.trim().isEmpty()) {
  prev.setSuccessful(false)
  prev.setResponseMessage('${label} expected ${variableName} to be set')
} else if (!body.contains(expected)) {
  prev.setSuccessful(false)
  prev.setResponseMessage('${label} getMessage response must contain ' + expected)
}`,
  );
}

function getMessageSampler(label, variableName) {
  const {wsSampler} = getScenarioTools();

  return wsSampler({
    name: `获取 ${label} 消息`,
    cmd: 'ChatManager.getMessage',
    info: {messageId: idVariable(variableName)},
    children: assertMessageIdPostProcessor(label, variableName),
  });
}

function sendAndGetMessageSamplers({label, variableName, info}) {
  const {sendMessageSampler} = getScenarioTools();

  return [
    sendMessageSampler({
      name: `发送 ${label} 消息`,
      scenarioName,
      variableName,
      info,
    }),
    getMessageSampler(label, variableName),
  ];
}

function missingFileErrorPostProcessor() {
  const {jsr223PostProcessor} = getScenarioTools();

  return jsr223PostProcessor(
    '断言缺失文件错误通过 WebSocket 返回',
    `import groovy.json.JsonSlurper

def root = new JsonSlurper().parseText(prev.getResponseDataAsString())
if (!(root instanceof Map) || root.ok != true) {
  prev.setSuccessful(false)
  prev.setResponseMessage('missing file send expected top-level ok=true')
} else if (root.value == null) {
  prev.setSuccessful(false)
  prev.setResponseMessage('missing file send expected non-null SDK error value')
}`,
  );
}

const basePeerMessage = {
  username: '${contactUserId}',
};

const sendTypeCases = [
  {
    label: 'text',
    variableName: 'textMessageId',
    info: {
      ...basePeerMessage,
      type: 'text',
      content: 'jmeter send text message',
    },
  },
  {
    label: 'image',
    variableName: 'imageMessageId',
    info: {
      ...basePeerMessage,
      type: 'image',
      fixtureName: 'test-image.jpg',
      displayName: 'test-image.jpg',
    },
  },
  {
    label: 'file',
    variableName: 'fileMessageId',
    info: {
      ...basePeerMessage,
      type: 'file',
      fixtureName: 'test-file.txt',
      displayName: 'test-file.txt',
    },
  },
  {
    label: 'large file',
    variableName: 'largeFileMessageId',
    info: {
      ...basePeerMessage,
      type: 'file',
      fixtureName: 'test-large-8mb.bin',
      displayName: 'test-large-8mb.bin',
    },
  },
  {
    label: 'voice',
    variableName: 'voiceMessageId',
    info: {
      ...basePeerMessage,
      type: 'voice',
      fixtureName: 'test-audio.m4a',
      displayName: 'test-audio.m4a',
      duration: 3,
    },
  },
  {
    label: 'video',
    variableName: 'videoMessageId',
    info: {
      ...basePeerMessage,
      type: 'video',
      fixtureName: 'test-video.mp4',
      displayName: 'test-video.mp4',
    },
  },
  {
    label: 'location',
    variableName: 'locationMessageId',
    info: {
      ...basePeerMessage,
      type: 'location',
      latitude: 31.2304,
      longitude: 121.4737,
      address: 'Shanghai',
    },
  },
  {
    label: 'cmd',
    variableName: 'cmdMessageId',
    info: {
      ...basePeerMessage,
      type: 'cmd',
      action: 'jmeter-send-types-command',
    },
  },
  {
    label: 'custom',
    variableName: 'customMessageId',
    info: {
      ...basePeerMessage,
      type: 'custom',
      event: 'jmeter.send.types.custom',
      data: {
        source: 'jmeter',
        scenario: scenarioName,
      },
    },
  },
];

function buildSamplers() {
  const {discoverContactSampler, wsSampler} = getScenarioTools();

  return [
    discoverContactSampler(scenarioName),
    ...sendTypeCases.flatMap(sendAndGetMessageSamplers),
    wsSampler({
      name: '发送缺失文件消息',
      cmd: 'ChatManager.sendMessage',
      info: {
        ...basePeerMessage,
        type: 'file',
        localPath: '/tmp/missing-jmeter-file.bin',
        displayName: 'missing-jmeter-file.bin',
      },
      assertSdkSuccess: false,
      children: missingFileErrorPostProcessor(),
    }),
  ];
}

module.exports = {
  filename: 'message-send-types.jmx',
  name: scenarioName,
  variables: [],
  get samplers() {
    return buildSamplers();
  },
};
