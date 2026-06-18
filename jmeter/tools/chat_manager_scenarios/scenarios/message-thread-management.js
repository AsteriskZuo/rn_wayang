const scenarioName = 'message-thread-management';

function raw(value) {
  return require('../generate').rawJson(value);
}

function extractThreadIdPostProcessor() {
  const {jsr223PostProcessor} = require('../generate');

  return jsr223PostProcessor(
    '提取 threadId',
    `import groovy.json.JsonSlurper

def root = new JsonSlurper().parseText(prev.getResponseDataAsString())
def findFirstString
findFirstString = { Object node, List names ->
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

if (!(root instanceof Map) || root.ok != true) {
  prev.setSuccessful(false)
  prev.setResponseMessage('${scenarioName} expected top-level ok=true before extracting threadId')
  return
}

def found = findFirstString(root.value, ['threadId', 'chatThreadId', 'id'])
if (found == null) {
  def message = 'PRECONDITION_FAILED: ${scenarioName} requires threadId, but ChatManager.createChatThread returned no thread id'
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
} else {
  vars.put('threadId', found)
}`,
  );
}

function threadSampler(name, cmd, info = {}) {
  const {wsSampler} = require('../generate');

  return wsSampler({
    name,
    cmd,
    info: {
      threadId: '${threadId}',
      ...info,
    },
  });
}

function parentThreadSampler(name, cmd) {
  const {wsSampler} = require('../generate');

  return wsSampler({
    name,
    cmd,
    info: {
      groupId: '${threadParentGroupId}',
      cursor: '${cursor}',
      pageSize: raw('${pageSize}'),
    },
  });
}

function buildSamplers() {
  const {
    discoverGroupSampler,
    sendMessageSampler,
    wsSampler,
  } = require('../generate');

  return [
    discoverGroupSampler(scenarioName, 'threadParentGroupId'),
    sendMessageSampler({
      name: '发送 thread parent 群文本消息',
      scenarioName,
      variableName: 'threadParentMessageId',
      info: {
        type: 'text',
        username: '${threadParentGroupId}',
        content: 'jmeter thread parent message ${__time()}',
        conversationType: 'GroupChat',
      },
    }),
    wsSampler({
      name: 'ChatManager.createChatThread',
      cmd: 'ChatManager.createChatThread',
      info: {
        name: 'jmeter-thread-${__time()}',
        msgId: '${threadParentMessageId}',
        groupId: '${threadParentGroupId}',
      },
      children: extractThreadIdPostProcessor(),
    }),
    threadSampler(
      'ChatManager.fetchChatThreadFromServer',
      'ChatManager.fetchChatThreadFromServer',
    ),
    wsSampler({
      name: 'ChatManager.getMessageThread',
      cmd: 'ChatManager.getMessageThread',
      info: {messageId: '${threadParentMessageId}'},
    }),
    threadSampler('ChatManager.getThreadConversation', 'ChatManager.getThreadConversation', {
      createIfNeed: true,
    }),
    threadSampler(
      'ChatManager.fetchMembersWithChatThreadFromServer',
      'ChatManager.fetchMembersWithChatThreadFromServer',
      {
        cursor: '${cursor}',
        pageSize: raw('${pageSize}'),
      },
    ),
    parentThreadSampler(
      'ChatManager.fetchChatThreadWithParentFromServer',
      'ChatManager.fetchChatThreadWithParentFromServer',
    ),
    parentThreadSampler(
      'ChatManager.fetchJoinedChatThreadWithParentFromServer',
      'ChatManager.fetchJoinedChatThreadWithParentFromServer',
    ),
    wsSampler({
      name: 'ChatManager.fetchJoinedChatThreadFromServer',
      cmd: 'ChatManager.fetchJoinedChatThreadFromServer',
      info: {
        cursor: '${cursor}',
        pageSize: raw('${pageSize}'),
      },
    }),
    wsSampler({
      name: 'ChatManager.fetchLastMessageWithChatThread',
      cmd: 'ChatManager.fetchLastMessageWithChatThread',
      info: {threadIds: '${threadId}'},
    }),
    threadSampler('ChatManager.updateChatThreadName', 'ChatManager.updateChatThreadName', {
      subject: 'jmeter-thread-updated-${__time()}',
    }),
    threadSampler('ChatManager.destroyChatThread', 'ChatManager.destroyChatThread'),
  ];
}

module.exports = {
  filename: 'message-thread-management.jmx',
  name: scenarioName,
  variables: [],
  get samplers() {
    return buildSamplers();
  },
};
