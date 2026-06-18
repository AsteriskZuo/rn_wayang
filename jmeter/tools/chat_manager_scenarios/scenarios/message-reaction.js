const scenarioName = 'message-reaction';

module.exports = {
  filename: 'message-reaction.jmx',
  name: scenarioName,
  variables: [],
  get samplers() {
    const {
      discoverContactSampler,
      rawJson,
      scriptSampler,
      sendMessageSampler,
      wsSampler,
    } = require('../generate');

    return [
      discoverContactSampler(scenarioName),
      scriptSampler(
        '设置 reaction',
        "vars.put('reaction', 'jmeter-reaction-' + System.currentTimeMillis())",
      ),
      sendMessageSampler({
        name: '发送单聊文本消息',
        scenarioName,
        info: {
          type: 'text',
          username: '${contactUserId}',
          content: 'jmeter reaction message ${__time()}',
          conversationType: 'PeerChat',
        },
        variableName: 'reactionMessageId',
      }),
      wsSampler({
        name: 'ChatManager.getMessage',
        cmd: 'ChatManager.getMessage',
        info: {messageId: '${messageId}'},
      }),
      wsSampler({
        name: 'ChatManager.addReaction',
        cmd: 'ChatManager.addReaction',
        info: {messageId: '${messageId}', reaction: '${reaction}'},
      }),
      wsSampler({
        name: 'ChatManager.getReactionList',
        cmd: 'ChatManager.getReactionList',
        info: {messageId: '${messageId}'},
      }),
      wsSampler({
        name: 'ChatManager.fetchReactionDetail',
        cmd: 'ChatManager.fetchReactionDetail',
        info: {
          messageId: '${messageId}',
          reaction: '${reaction}',
          cursor: '${cursor}',
          pageSize: rawJson('${pageSize}'),
        },
      }),
      wsSampler({
        name: 'ChatManager.fetchReactionList',
        cmd: 'ChatManager.fetchReactionList',
        info: {
          messageIds: '${messageIds}',
          conversationType: 'PeerChat',
          groupId: '',
        },
      }),
      wsSampler({
        name: 'ChatManager.removeReaction',
        cmd: 'ChatManager.removeReaction',
        info: {messageId: '${messageId}', reaction: '${reaction}'},
      }),
      wsSampler({
        name: 'ChatManager.getReactionList after remove',
        cmd: 'ChatManager.getReactionList',
        info: {messageId: '${messageId}'},
      }),
    ];
  },
};
