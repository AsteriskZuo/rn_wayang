const scenarioName = 'message-pin';

module.exports = {
  filename: 'message-pin.jmx',
  name: scenarioName,
  variables: [],
  get samplers() {
    const {discoverContactSampler, sendMessageSampler, wsSampler} =
      require('../generate');

    return [
      discoverContactSampler(scenarioName),
      sendMessageSampler({
        name: '发送待 pin 单聊文本消息',
        scenarioName,
        variableName: 'pinMessageId',
        info: {
          type: 'text',
          username: '${contactUserId}',
          content: 'jmeter pin message ${__time()}',
          conversationType: '${conversationType}',
        },
      }),
      wsSampler({
        name: 'ChatManager.getMessage',
        cmd: 'ChatManager.getMessage',
        info: {messageId: '${messageId}'},
      }),
      wsSampler({
        name: 'ChatManager.pinMessage',
        cmd: 'ChatManager.pinMessage',
        info: {messageId: '${messageId}'},
      }),
      wsSampler({
        name: 'ChatManager.getMessagePinInfo',
        cmd: 'ChatManager.getMessagePinInfo',
        info: {messageId: '${messageId}'},
      }),
      wsSampler({
        name: 'ChatManager.getPinnedMessages',
        cmd: 'ChatManager.getPinnedMessages',
        info: {
          conversationId: '${conversationId}',
          conversationType: '${conversationType}',
          isChatThread: false,
        },
      }),
      wsSampler({
        name: 'ChatManager.fetchPinnedMessages',
        cmd: 'ChatManager.fetchPinnedMessages',
        info: {
          conversationId: '${conversationId}',
          conversationType: '${conversationType}',
          isChatThread: false,
        },
      }),
      wsSampler({
        name: 'ChatManager.unpinMessage',
        cmd: 'ChatManager.unpinMessage',
        info: {messageId: '${messageId}'},
      }),
      wsSampler({
        name: 'ChatManager.getPinnedMessages after unpin',
        cmd: 'ChatManager.getPinnedMessages',
        info: {
          conversationId: '${conversationId}',
          conversationType: '${conversationType}',
          isChatThread: false,
        },
      }),
    ];
  },
};
