const scenarioName = 'message-conversation';

function helpers() {
  return require('../generate');
}

function raw(value) {
  return helpers().rawJson(value);
}

function conversationInfo(extra = {}) {
  return {
    conversationId: '${conversationId}',
    conversationType: '${conversationType}',
    ...extra,
  };
}

function conversationSampler(name, cmd, info = {}) {
  return helpers().wsSampler({
    name,
    cmd,
    info: conversationInfo(info),
  });
}

function buildSamplers() {
  const {
    discoverContactSampler,
    scriptSampler,
    sendMessageSampler,
    wsSampler,
  } = helpers();

  return [
    discoverContactSampler(scenarioName),
    scriptSampler(
      '设置单聊会话变量',
      "vars.put('conversationType', 'PeerChat')\nvars.put('convIds', vars.get('conversationId'))\nvars.put('isChatThread', 'false')",
    ),
    scriptSampler(
      '准备会话消息内容',
      `vars.put('content', 'message-conversation-' + System.currentTimeMillis() + '-' + ctx.getThreadNum())`,
    ),
    sendMessageSampler({
      name: '发送会话 peer 文本消息',
      scenarioName,
      variableName: 'conversationMessageId',
      info: {
        type: 'text',
        username: '${contactUserId}',
        content: '${content}',
        conversationType: '${conversationType}',
        isChatThread: false,
      },
    }),

    conversationSampler('获取会话', 'ChatManager.getConversation', {
      createIfNeed: true,
    }),
    wsSampler({
      name: '获取全部会话',
      cmd: 'ChatManager.getAllConversations',
      info: {},
    }),
    conversationSampler('获取最新消息', 'ChatManager.getLatestMessage', {
      isChatThread: false,
    }),
    conversationSampler(
      '获取最新收到消息',
      'ChatManager.getLatestReceivedMessage',
    ),
    wsSampler({
      name: '获取未读总数',
      cmd: 'ChatManager.getUnreadCount',
      info: {},
    }),
    conversationSampler(
      '获取会话未读数',
      'ChatManager.getConversationUnreadCount',
    ),
    conversationSampler(
      '获取会话消息数',
      'ChatManager.getConversationMessageCount',
      {
        isChatThread: false,
      },
    ),
    conversationSampler('标记消息已读', 'ChatManager.markMessageAsRead', {
      messageId: '${messageId}',
    }),
    conversationSampler('标记会话全部消息已读', 'ChatManager.markAllMessagesAsRead'),
    wsSampler({
      name: '发送会话已读回执',
      cmd: 'ChatManager.sendConversationReadAck',
      info: {conversationId: '${conversationId}'},
    }),
    scriptSampler(
      '准备会话扩展字典',
      "vars.put('dict', groovy.json.JsonOutput.toJson([source: 'jmeter', scenario: 'conversation']))",
    ),
    wsSampler({
      name: '设置会话扩展',
      cmd: 'ChatManager.setConversationExtension',
      infoJson:
        '{"conversationId":"${conversationId}","conversationType":"${conversationType}","dict":${dict}}',
    }),
    conversationSampler('获取设置扩展后的会话', 'ChatManager.getConversation', {
      createIfNeed: true,
    }),
    wsSampler({
      name: '置顶会话',
      cmd: 'ChatManager.pinConversation',
      info: {
        conversationId: '${conversationId}',
        isPinned: true,
      },
    }),
    wsSampler({
      name: '从服务端分页获取置顶会话',
      cmd: 'ChatManager.fetchPinnedConversationsFromServerWithCursor',
      info: {
        cursor: '${cursor}',
        pageSize: raw('${pageSize}'),
      },
    }),
    wsSampler({
      name: '取消置顶会话',
      cmd: 'ChatManager.pinConversation',
      info: {
        conversationId: '${conversationId}',
        isPinned: false,
      },
    }),
    wsSampler({
      name: '添加远端和本地会话标记',
      cmd: 'ChatManager.addRemoteAndLocalConversationsMark',
      info: {
        convIds: '${convIds}',
        mark: 0,
      },
    }),
    wsSampler({
      name: '按选项拉取会话',
      cmd: 'ChatManager.fetchConversationsByOptions',
      info: {
        cursor: '${cursor}',
        pageSize: raw('${pageSize}'),
        mark: 0,
      },
    }),
    wsSampler({
      name: '删除远端和本地会话标记',
      cmd: 'ChatManager.deleteRemoteAndLocalConversationsMark',
      info: {
        convIds: '${convIds}',
        mark: 0,
      },
    }),
    wsSampler({
      name: '从服务端分页获取会话',
      cmd: 'ChatManager.fetchConversationsFromServerWithCursor',
      info: {
        cursor: '${cursor}',
        pageSize: raw('${pageSize}'),
      },
    }),
    wsSampler({
      name: '删除本地会话',
      cmd: 'ChatManager.deleteConversation',
      info: {
        conversationId: '${conversationId}',
        withMessage: '0',
      },
    }),
    conversationSampler('删除后获取会话', 'ChatManager.getConversation', {
      createIfNeed: false,
    }),
    conversationSampler('从服务端移除会话', 'ChatManager.removeConversationFromServer', {
      isDeleteServerMessages: false,
    }),
  ];
}

module.exports = {
  filename: 'message-conversation.jmx',
  name: scenarioName,
  variables: [],
  get samplers() {
    return buildSamplers();
  },
};
