const scenarioName = 'message-target-types';

function helpers() {
  return require('../generate');
}

function getMessageSampler(name, variableName) {
  return helpers().wsSampler({
    name,
    cmd: 'ChatManager.getMessage',
    info: {messageId: `\${${variableName}}`},
  });
}

function extractThreadIdPostProcessor() {
  return helpers().jsr223PostProcessor(
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

def found = findFirstString(root.value, ['threadId', 'chatThreadId', 'id'])
if (found == null) {
  def message = 'PRECONDITION_FAILED: ${scenarioName} requires threadId, but ChatManager.createChatThread returned no usable thread id'
  prev.setSuccessful(false)
  prev.setResponseCode('PRECONDITION_FAILED')
  prev.setResponseMessage(message)
  prev.setResponseData(message + '\\n' + prev.getResponseDataAsString(), 'UTF-8')
  ctx.getThread().stop()
} else {
  vars.put('threadId', found)
  vars.put('conversationId', found)
  vars.put('conversationType', 'GroupChat')
  vars.put('isChatThread', 'true')
}`,
  );
}

function sendTextSampler({name, variableName, username, conversationType, content, isChatThread}) {
  const info = {
    username,
    conversationType,
    type: 'text',
    content,
  };

  if (isChatThread !== undefined) {
    info.isChatThread = isChatThread;
  }

  return helpers().sendMessageSampler({
    name,
    scenarioName,
    variableName,
    info,
  });
}

function peerContactSamplers() {
  return [
    helpers().discoverContactSampler(scenarioName),
    sendTextSampler({
      name: 'Peer contact - 发送文本消息',
      variableName: 'peerMessageId',
      username: '${contactUserId}',
      conversationType: 'PeerChat',
      content: 'jmeter target peer ${__time()}',
    }),
    getMessageSampler('Peer contact - ChatManager.getMessage', 'peerMessageId'),
  ];
}

function joinedGroupSamplers() {
  return [
    helpers().discoverGroupSampler(scenarioName),
    sendTextSampler({
      name: 'Joined group - 发送文本消息',
      variableName: 'groupMessageId',
      username: '${groupId}',
      conversationType: 'GroupChat',
      content: 'jmeter target group ${__time()}',
    }),
    getMessageSampler('Joined group - ChatManager.getMessage', 'groupMessageId'),
    helpers().wsSampler({
      name: 'Joined group - ChatManager.getLatestMessage',
      cmd: 'ChatManager.getLatestMessage',
      info: {
        conversationId: '${groupId}',
        conversationType: 'GroupChat',
        isChatThread: false,
      },
    }),
  ];
}

function publicChatRoomSamplers() {
  return [
    helpers().discoverRoomSampler(scenarioName),
    helpers().wsSampler({
      name: 'Public chat room - ChatRoomManager.joinChatRoomEx',
      cmd: 'ChatRoomManager.joinChatRoomEx',
      info: {
        roomId: '${roomId}',
        exitOtherRoom: true,
        ext: 'jmeter target chat room',
      },
    }),
    sendTextSampler({
      name: 'Public chat room - 发送文本消息',
      variableName: 'roomMessageId',
      username: '${roomId}',
      conversationType: 'ChatRoom',
      content: 'jmeter target room ${__time()}',
    }),
    getMessageSampler('Public chat room - ChatManager.getMessage', 'roomMessageId'),
    helpers().wsSampler({
      name: 'Public chat room - ChatRoomManager.leaveChatRoom',
      cmd: 'ChatRoomManager.leaveChatRoom',
      info: {roomId: '${roomId}'},
    }),
  ];
}

function chatThreadSamplers() {
  return [
    helpers().discoverGroupSampler(scenarioName),
    sendTextSampler({
      name: 'Chat thread - 发送父群消息',
      variableName: 'parentGroupMessageId',
      username: '${groupId}',
      conversationType: 'GroupChat',
      content: 'jmeter target thread parent ${__time()}',
      isChatThread: false,
    }),
    helpers().wsSampler({
      name: 'Chat thread - ChatManager.createChatThread',
      cmd: 'ChatManager.createChatThread',
      info: {
        name: 'jmeter-target-thread-${__time()}',
        msgId: '${parentGroupMessageId}',
        groupId: '${groupId}',
      },
      children: extractThreadIdPostProcessor(),
    }),
    sendTextSampler({
      name: 'Chat thread - 发送线程文本消息',
      variableName: 'threadMessageId',
      username: '${threadId}',
      conversationType: 'GroupChat',
      content: 'jmeter target thread ${__time()}',
      isChatThread: true,
    }),
    getMessageSampler('Chat thread - ChatManager.getMessage', 'threadMessageId'),
  ];
}

module.exports = {
  filename: 'message-target-types.jmx',
  name: scenarioName,
  variables: [],
  get samplers() {
    return [
      ...peerContactSamplers(),
      ...joinedGroupSamplers(),
      ...publicChatRoomSamplers(),
      ...chatThreadSamplers(),
    ];
  },
};
