const scenarioName = 'message-recall-delete';

function tools() {
  return require('../generate');
}

function raw(value) {
  return tools().rawJson(value);
}

function textMessageInfo(content) {
  return {
    type: 'text',
    username: '${contactUserId}',
    conversationType: '${conversationType}',
    isChatThread: false,
    content,
  };
}

function getMessageSampler(name, messageIdVariable, children = '') {
  return tools().wsSampler({
    name,
    cmd: 'ChatManager.getMessage',
    info: {messageId: `\${${messageIdVariable}}`},
    children,
  });
}

function unavailableAssertion(name, messageIdVariable) {
  return tools().jsr223PostProcessor(
    name,
    `def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def value = root instanceof Map ? root.value : null
if (value != null && value.toString().contains(vars.get('${messageIdVariable}'))) {
  prev.setSuccessful(false)
  prev.setResponseMessage('${messageIdVariable} should be unavailable')
}`,
  );
}

function existsAssertion(name, messageIdVariable) {
  return tools().jsr223PostProcessor(
    name,
    `def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def value = root instanceof Map ? root.value : null
if (value == null || !value.toString().contains(vars.get('${messageIdVariable}'))) {
  prev.setSuccessful(false)
  prev.setResponseMessage('${messageIdVariable} should still exist')
}`,
  );
}

function recallAssertion(name, messageIdVariable) {
  return tools().jsr223PostProcessor(
    name,
    `def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def value = root instanceof Map ? root.value : null
def serialized = value == null ? '' : value.toString()
if (serialized.contains(vars.get('${messageIdVariable}')) && serialized.contains('jmeter recall ')) {
  prev.setSuccessful(false)
  prev.setResponseMessage('${messageIdVariable} should not remain a normal original message after recall')
}`,
  );
}

function extractSafeBeforeTimestamp() {
  return tools().jsr223PostProcessor(
    '提取安全删除前时间戳',
    `def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def findNumber
findNumber = { Object node, List names ->
  if (node == null) {
    return null
  }
  if (node instanceof Map) {
    for (name in names) {
      if (node.containsKey(name) && node[name] != null && node[name].toString().isNumber()) {
        return node[name].toString().toLong()
      }
    }
    for (entry in node.values()) {
      def found = findNumber(entry, names)
      if (found != null) {
        return found
      }
    }
  }
  if (node instanceof List) {
    for (entry in node) {
      def found = findNumber(entry, names)
      if (found != null) {
        return found
      }
    }
  }
  return null
}
def sentTimestamp = findNumber(root.value, ['serverTime', 'localTime', 'timestamp', 'msgTime'])
def safeBeforeTimestamp = sentTimestamp == null ? System.currentTimeMillis() - 1 : sentTimestamp - 1
vars.put('timestamp', safeBeforeTimestamp.toString())`,
  );
}

function extractLocalRangeDeleteWindow() {
  return tools().jsr223PostProcessor(
    '提取本地时间范围删除窗口',
    `def root = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString())
def findNumber
findNumber = { Object node, List names ->
  if (node == null) {
    return null
  }
  if (node instanceof Map) {
    for (name in names) {
      if (node.containsKey(name) && node[name] != null && node[name].toString().isNumber()) {
        return node[name].toString().toLong()
      }
    }
    for (entry in node.values()) {
      def found = findNumber(entry, names)
      if (found != null) {
        return found
      }
    }
  }
  if (node instanceof List) {
    for (entry in node) {
      def found = findNumber(entry, names)
      if (found != null) {
        return found
      }
    }
  }
  return null
}
def sentTimestamp = findNumber(root.value, ['serverTime', 'localTime', 'timestamp', 'msgTime'])
if (sentTimestamp == null) {
  prev.setSuccessful(false)
  prev.setResponseMessage('localRangeDeleteMessageId response did not contain a message timestamp')
} else {
  vars.put('startTime', (sentTimestamp - 1).toString())
  vars.put('endTime', (sentTimestamp + 1).toString())
}`,
  );
}

function samplers() {
  const {
    discoverContactSampler,
    sendMessageSampler,
    scriptSampler,
    wsSampler,
  } = tools();

  return [
    discoverContactSampler(scenarioName),
    scriptSampler(
      '设置单聊删除变量',
      "vars.put('conversationType', 'PeerChat')\nvars.put('isChatThread', 'false')",
    ),

    sendMessageSampler({
      name: '发送本地单条删除目标消息',
      scenarioName,
      variableName: 'localDeleteMessageId',
      info: textMessageInfo('jmeter local single delete ${__time()}'),
    }),
    getMessageSampler('获取本地单条删除前消息', 'localDeleteMessageId'),
    wsSampler({
      name: '本地单条删除',
      cmd: 'ChatManager.deleteMessage',
      info: {
        conversationId: '${conversationId}',
        conversationType: '${conversationType}',
        messageId: '${localDeleteMessageId}',
      },
    }),
    getMessageSampler(
      '验证本地单条删除后不可用',
      'localDeleteMessageId',
      unavailableAssertion('断言本地单条删除后不可用', 'localDeleteMessageId'),
    ),

    sendMessageSampler({
      name: '发送本地时间范围删除目标消息',
      scenarioName,
      variableName: 'localRangeDeleteMessageId',
      info: textMessageInfo('jmeter local range delete ${__time()}'),
      children: extractLocalRangeDeleteWindow(),
    }),
    wsSampler({
      name: '本地按时间范围删除',
      cmd: 'ChatManager.deleteMessagesWithTimestamp',
      info: {
        conversationId: '${conversationId}',
        conversationType: '${conversationType}',
        startTime: raw('${startTime}'),
        endTime: raw('${endTime}'),
        isChatThread: false,
      },
    }),
    getMessageSampler(
      '验证本地时间范围删除后不可用',
      'localRangeDeleteMessageId',
      unavailableAssertion(
        '断言本地时间范围删除后不可用',
        'localRangeDeleteMessageId',
      ),
    ),

    sendMessageSampler({
      name: '发送删除前时间戳安全目标消息',
      scenarioName,
      variableName: 'beforeTimestampSafetyMessageId',
      info: textMessageInfo('jmeter delete-before safety ${__time()}'),
    }),
    getMessageSampler(
      '获取删除前时间戳安全目标消息',
      'beforeTimestampSafetyMessageId',
      extractSafeBeforeTimestamp(),
    ),
    wsSampler({
      name: '删除安全时间戳前消息',
      cmd: 'ChatManager.deleteMessagesBeforeTimestamp',
      info: {timestamp: raw('${timestamp}')},
    }),
    getMessageSampler(
      '验证安全时间戳目标仍存在',
      'beforeTimestampSafetyMessageId',
      existsAssertion(
        '断言安全时间戳目标仍存在',
        'beforeTimestampSafetyMessageId',
      ),
    ),

    sendMessageSampler({
      name: '发送撤回目标消息',
      scenarioName,
      variableName: 'recallMessageId',
      info: textMessageInfo('jmeter recall ${__time()}'),
    }),
    wsSampler({
      name: '撤回消息',
      cmd: 'ChatManager.recallMessage',
      info: {messageId: '${recallMessageId}'},
    }),
    getMessageSampler(
      '观察撤回后消息状态',
      'recallMessageId',
      recallAssertion('断言撤回后不是正常原始消息', 'recallMessageId'),
    ),

    sendMessageSampler({
      name: '发送服务端按 ID 删除目标消息',
      scenarioName,
      variableName: 'serverRemoveMessageId',
      info: textMessageInfo('jmeter server remove id ${__time()}'),
    }),
    scriptSampler(
      '设置服务端删除消息 ID 列表',
      "vars.put('messageIds', vars.get('serverRemoveMessageId'))",
    ),
    wsSampler({
      name: '服务端按消息 ID 删除',
      cmd: 'ChatManager.removeMessagesFromServerWithMsgIds',
      info: {
        conversationId: '${conversationId}',
        conversationType: '${conversationType}',
        messageIds: '${messageIds}',
        isChatThread: false,
      },
    }),
    wsSampler({
      name: '按 ID 服务端删除后拉取历史消息',
      cmd: 'ChatManager.fetchHistoryMessagesByOptions',
      info: {
        conversationId: '${conversationId}',
        conversationType: '${conversationType}',
        cursor: '${cursor}',
        pageSize: raw('${pageSize}'),
        options: {},
      },
    }),

    scriptSampler(
      '记录服务端时间戳删除时间',
      "vars.put('timestamp', System.currentTimeMillis().toString())",
    ),
    sendMessageSampler({
      name: '发送服务端按时间戳删除目标消息',
      scenarioName,
      variableName: 'serverTimestampRemoveMessageId',
      info: textMessageInfo('jmeter server remove timestamp ${__time()}'),
    }),
    wsSampler({
      name: '服务端按时间戳删除',
      cmd: 'ChatManager.removeMessagesFromServerWithTimestamp',
      info: {
        conversationId: '${conversationId}',
        conversationType: '${conversationType}',
        timestamp: raw('${timestamp}'),
        isChatThread: false,
      },
    }),
    wsSampler({
      name: '按时间戳服务端删除后拉取历史消息',
      cmd: 'ChatManager.fetchHistoryMessagesByOptions',
      info: {
        conversationId: '${conversationId}',
        conversationType: '${conversationType}',
        cursor: '${cursor}',
        pageSize: raw('${pageSize}'),
        options: {},
      },
    }),

    sendMessageSampler({
      name: '发送删除会话全部消息目标',
      scenarioName,
      variableName: 'deleteConversationAllMessageId',
      info: textMessageInfo('jmeter delete conversation all ${__time()}'),
    }),
    wsSampler({
      name: '删除会话全部消息',
      cmd: 'ChatManager.deleteConversationAllMessages',
      info: {
        conversationId: '${conversationId}',
        conversationType: '${conversationType}',
        isChatThread: false,
      },
    }),
    getMessageSampler(
      '验证删除会话全部消息后不可用',
      'deleteConversationAllMessageId',
      unavailableAssertion(
        '断言删除会话全部消息后不可用',
        'deleteConversationAllMessageId',
      ),
    ),
  ];
}

const scenario = {
  filename: 'message-recall-delete.jmx',
  name: scenarioName,
  variables: [],
  samplers: [],
};

scenario.samplers[Symbol.iterator] = function* iterateRecallDeleteSamplers() {
  yield* samplers();
};

module.exports = {
  ...scenario,
};
