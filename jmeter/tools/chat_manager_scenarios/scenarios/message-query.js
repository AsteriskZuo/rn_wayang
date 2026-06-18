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

function querySampler(name, cmd, info = {}) {
  return helpers().wsSampler({
    name,
    cmd,
    info,
  });
}

function queryConversationSampler(name, cmd, info = {}) {
  return querySampler(name, cmd, conversationInfo(info));
}

function sendQueryTextMessage(name, variableName, suffix) {
  return helpers().sendMessageSampler({
    name,
    scenarioName: 'message-query',
    variableName,
    info: {
      username: '${conversationId}',
      conversationType: '${conversationType}',
      type: 'text',
      content: `\${queryKeyword} ${suffix}`,
    },
  });
}

function sendQueryImageMessage() {
  return helpers().sendMessageSampler({
    name: '发送查询图片消息',
    scenarioName: 'message-query',
    variableName: 'queryImageMessageId',
    info: {
      username: '${conversationId}',
      conversationType: '${conversationType}',
      type: 'image',
      fixtureName: 'test-image.jpg',
    },
  });
}

module.exports = {
  filename: 'message-query.jmx',
  name: 'message-query',
  variables: [],
  get samplers() {
    const {discoverContactSampler, scriptSampler} = helpers();

    return [
      discoverContactSampler('message-query'),
      scriptSampler(
        '设置查询关键字和起始时间',
        `def now = System.currentTimeMillis()
vars.put('queryKeyword', 'jmeter-query-' + now)
vars.put('startTime', now.toString())
vars.put('timestamp', now.toString())`,
      ),
      sendQueryTextMessage('发送查询文本消息 1', 'queryTextMessageId1', 'text-1'),
      sendQueryTextMessage('发送查询文本消息 2', 'queryTextMessageId2', 'text-2'),
      sendQueryImageMessage(),
      scriptSampler(
        '设置查询消息集合和结束时间',
        `def end = System.currentTimeMillis()
vars.put('messageIds', [
  vars.get('queryTextMessageId1'),
  vars.get('queryTextMessageId2'),
  vars.get('queryImageMessageId')
].findAll { it != null && it.toString().trim() }.join(','))
vars.put('endTime', end.toString())
vars.put('start', vars.get('startTime'))
vars.put('end', end.toString())`,
      ),
      querySampler('按消息 ID 查询消息', 'ChatManager.getMessage', {
        messageId: '${queryTextMessageId1}',
      }),
      queryConversationSampler('按消息 ID 列表查询消息', 'ChatManager.getMessagesWithIds', {
        messageIds: '${messageIds}',
      }),
      queryConversationSampler('查询会话消息', 'ChatManager.getMsgs', {
        count: raw('${count}'),
        direction: '${direction}',
        isChatThread: raw('${isChatThread}'),
      }),
      queryConversationSampler('按文本类型查询会话消息', 'ChatManager.getMsgsWithMsgType', {
        msgType: 'txt',
        timestamp: raw('${timestamp}'),
        count: raw('${count}'),
        direction: 'DOWN',
        isChatThread: raw('${isChatThread}'),
      }),
      queryConversationSampler('按图片类型查询会话消息', 'ChatManager.getMsgsWithMsgType', {
        msgType: 'img',
        timestamp: raw('${timestamp}'),
        count: raw('${count}'),
        direction: 'DOWN',
        isChatThread: raw('${isChatThread}'),
      }),
      queryConversationSampler('按关键字查询会话消息', 'ChatManager.getConvMsgsWithKeyword', {
        keywords: '${queryKeyword}',
        timestamp: raw('${timestamp}'),
        count: raw('${count}'),
        direction: 'DOWN',
        searchScope: 'all',
        isChatThread: raw('${isChatThread}'),
      }),
      querySampler('按关键字查询消息', 'ChatManager.getMsgsWithKeyword', {
        keywords: '${queryKeyword}',
        timestamp: raw('${timestamp}'),
        maxCount: raw('${count}'),
        from: '${conversationId}',
        direction: 'DOWN',
        searchScope: 'all',
      }),
      querySampler('按关键字查询多会话消息', 'ChatManager.getConvsMsgsWithKeyword', {
        keywords: '${queryKeyword}',
        timestamp: raw('${timestamp}'),
        from: '${conversationId}',
        direction: 'DOWN',
        searchScope: 'all',
      }),
      queryConversationSampler('按时间范围查询消息', 'ChatManager.getMsgWithTimestamp', {
        startTime: raw('${startTime}'),
        endTime: raw('${endTime}'),
        count: raw('${count}'),
        direction: 'DOWN',
        isChatThread: raw('${isChatThread}'),
      }),
      queryConversationSampler(
        '按时间范围查询消息数量',
        'ChatManager.getMessageCountWithTimestamp',
        {
          start: raw('${start}'),
          end: raw('${end}'),
          isChatThread: raw('${isChatThread}'),
        },
      ),
      querySampler('按类型搜索消息', 'ChatManager.searchMessages', {
        msgTypes: 'txt,img',
        timestamp: raw('${timestamp}'),
        count: raw('${count}'),
        from: '${conversationId}',
        direction: 'DOWN',
        isChatThread: raw('${isChatThread}'),
      }),
      queryConversationSampler('在会话内按类型搜索消息', 'ChatManager.searchMessagesInConversation', {
        msgTypes: 'txt,img',
        timestamp: raw('${timestamp}'),
        count: raw('${count}'),
        from: '${conversationId}',
        direction: 'DOWN',
        isChatThread: raw('${isChatThread}'),
      }),
      queryConversationSampler(
        '按选项拉取历史消息',
        'ChatManager.fetchHistoryMessagesByOptions',
        {
          options: {},
        },
      ),
      querySampler('查询消息总数', 'ChatManager.getMessageCount'),
    ];
  },
};
