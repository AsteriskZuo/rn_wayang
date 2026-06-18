const scenarioName = 'message-basic-lifecycle';

function extractBodyScript() {
  return `import groovy.json.JsonOutput
import groovy.json.JsonSlurper

def root = new JsonSlurper().parseText(prev.getResponseDataAsString())
def expectedMessageId = vars.get('messageId')

def fail = { String message ->
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
}

if (!(root instanceof Map) || root.ok != true) {
  fail('PRECONDITION_FAILED: ${scenarioName} requires ChatManager.getMessage ok=true before extracting body')
  return
}

def hasMessageId = { Object node, String id ->
  if (!(node instanceof Map) || id == null || id.trim().isEmpty()) {
    return false
  }
  for (name in ['msgId', 'messageId', 'id']) {
    if (node.containsKey(name) && node[name] != null && node[name].toString() == id) {
      return true
    }
  }
  return false
}

def findMessage
findMessage = { Object node, String id ->
  if (node == null) {
    return null
  }
  if (node instanceof Map) {
    if (hasMessageId(node, id) && node.body instanceof Map) {
      return node
    }
    for (entry in node.values()) {
      def found = findMessage(entry, id)
      if (found != null) {
        return found
      }
    }
  }
  if (node instanceof List) {
    for (entry in node) {
      def found = findMessage(entry, id)
      if (found != null) {
        return found
      }
    }
  }
  return null
}

def message = findMessage(root.value, expectedMessageId)
if (message == null) {
  fail('PRECONDITION_FAILED: ${scenarioName} requires getMessage to return the sent messageId before modifyMsgBody')
  return
}

def body = message.body
if (!(body instanceof Map)) {
  fail('PRECONDITION_FAILED: ${scenarioName} requires getMessage response value.body to be an object')
  return
}

def modifiedText = 'message-basic-lifecycle-modified-' + System.currentTimeMillis() + '-' + ctx.getThreadNum()
if (body.containsKey('text')) {
  body.text = modifiedText
}
if (body.containsKey('content')) {
  body.content = modifiedText
}
if (!body.containsKey('text') && !body.containsKey('content')) {
  body.content = modifiedText
}

vars.put('body', JsonOutput.toJson(body))
vars.put('modifiedContent', modifiedText)
`;
}

function assertModifiedMessageScript() {
  return `import groovy.json.JsonSlurper

def root = new JsonSlurper().parseText(prev.getResponseDataAsString())
def expectedMessageId = vars.get('messageId')
def expectedText = vars.get('modifiedContent')

def fail = { String message ->
  prev.setSuccessful(false)
  prev.setResponseCode('ASSERTION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
}

def hasMessageId = { Object node, String id ->
  if (!(node instanceof Map) || id == null || id.trim().isEmpty()) {
    return false
  }
  for (name in ['msgId', 'messageId', 'id']) {
    if (node.containsKey(name) && node[name] != null && node[name].toString() == id) {
      return true
    }
  }
  return false
}

def findMessage
findMessage = { Object node, String id ->
  if (node == null) {
    return null
  }
  if (node instanceof Map) {
    if (hasMessageId(node, id)) {
      return node
    }
    for (entry in node.values()) {
      def found = findMessage(entry, id)
      if (found != null) {
        return found
      }
    }
  }
  if (node instanceof List) {
    for (entry in node) {
      def found = findMessage(entry, id)
      if (found != null) {
        return found
      }
    }
  }
  return null
}

def message = findMessage(root.value, expectedMessageId)
if (message == null) {
  fail('ASSERTION_FAILED: ${scenarioName} expected getMessage to return the modified messageId')
  return
}

def body = message.body
def actualText = null
if (body instanceof Map) {
  actualText = body.text
  if (actualText == null) {
    actualText = body.content
  }
}
if (actualText == null || actualText.toString() != expectedText) {
  fail('ASSERTION_FAILED: ${scenarioName} expected modified message body text/content to match modifiedContent')
}
`;
}

function assertDeletedMessageScript() {
  return `import groovy.json.JsonSlurper

def root = new JsonSlurper().parseText(prev.getResponseDataAsString())
def deletedMessageId = vars.get('messageId')

def fail = { String message ->
  prev.setSuccessful(false)
  prev.setResponseCode('ASSERTION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
}

def containsMessageId
containsMessageId = { Object node, String id ->
  if (node == null || id == null || id.trim().isEmpty()) {
    return false
  }
  if (node instanceof Map) {
    for (name in ['msgId', 'messageId', 'id']) {
      if (node.containsKey(name) && node[name] != null && node[name].toString() == id) {
        return true
      }
    }
    for (entry in node.values()) {
      if (containsMessageId(entry, id)) {
        return true
      }
    }
  }
  if (node instanceof List) {
    for (entry in node) {
      if (containsMessageId(entry, id)) {
        return true
      }
    }
  }
  return false
}

if (containsMessageId(root.value, deletedMessageId)) {
  fail('ASSERTION_FAILED: ${scenarioName} expected getMessage after deleteMessage not to return the deleted messageId')
}
`;
}

function buildSamplers() {
  const {
    discoverContactSampler,
    sendMessageSampler,
    wsSampler,
    jsr223PostProcessor,
    scriptSampler,
    setVarsSampler,
  } = require('../generate');

  return [
    setVarsSampler('初始化基础消息生命周期变量', {
      body: '{}',
      messageId: '',
      messageIds: '',
    }),
    discoverContactSampler(scenarioName),
    scriptSampler(
      '准备唯一 peer 文本内容',
      `vars.put('content', 'message-basic-lifecycle-' + System.currentTimeMillis() + '-' + ctx.getThreadNum())`,
    ),
    sendMessageSampler({
      name: '发送 peer 文本消息',
      scenarioName,
      info: {
        type: 'text',
        username: '${contactUserId}',
        content: '${content}',
        conversationType: '${conversationType}',
      },
    }),
    wsSampler({
      name: 'ChatManager.getMessage - 修改前',
      cmd: 'ChatManager.getMessage',
      info: {messageId: '${messageId}'},
      children: jsr223PostProcessor('提取并修改完整 body', extractBodyScript()),
    }),
    wsSampler({
      name: 'ChatManager.modifyMsgBody',
      cmd: 'ChatManager.modifyMsgBody',
      infoJson: '{"messageId":"${messageId}","body":${body}}',
    }),
    wsSampler({
      name: 'ChatManager.getMessage - 修改后',
      cmd: 'ChatManager.getMessage',
      info: {messageId: '${messageId}'},
      children: jsr223PostProcessor('断言消息 body 已修改', assertModifiedMessageScript()),
    }),
    wsSampler({
      name: 'ChatManager.deleteMessage',
      cmd: 'ChatManager.deleteMessage',
      info: {
        conversationId: '${conversationId}',
        conversationType: '${conversationType}',
        messageId: '${messageId}',
      },
    }),
    wsSampler({
      name: 'ChatManager.getMessage - 删除后',
      cmd: 'ChatManager.getMessage',
      info: {messageId: '${messageId}'},
      children: jsr223PostProcessor('断言本地删除后不再返回同一 messageId', assertDeletedMessageScript()),
    }),
  ];
}

module.exports = {
  filename: 'message-basic-lifecycle.jmx',
  name: scenarioName,
  variables: [],
  get samplers() {
    return buildSamplers();
  },
};
