function lazySampler(build) {
  return {
    toString() {
      return build(require('../generate'));
    },
  };
}

module.exports = {
  filename: 'message-translation.jmx',
  name: 'message-translation',
  variables: [],
  samplers: [
    lazySampler(({discoverContactSampler}) =>
      discoverContactSampler('message-translation'),
    ),
    lazySampler(({wsSampler}) =>
      wsSampler({
        name: 'Fetch supported translation languages',
        cmd: 'ChatManager.fetchSupportedLanguages',
        info: {},
      }),
    ),
    lazySampler(({sendMessageSampler}) =>
      sendMessageSampler({
        name: 'Send translatable text message',
        scenarioName: 'message-translation',
        variableName: 'translationMessageId',
        info: {
          type: 'text',
          username: '${contactUserId}',
          conversationType: '${conversationType}',
          content: 'Hola desde JMeter translation ${__time()}',
        },
      }),
    ),
    lazySampler(({wsSampler}) =>
      wsSampler({
        name: 'Translate message',
        cmd: 'ChatManager.translateMessage',
        infoJson:
          '{"messageId":"${translationMessageId}","languages":["${languages}"]}',
      }),
    ),
    lazySampler(({wsSampler}) =>
      wsSampler({
        name: 'Get translated message',
        cmd: 'ChatManager.getMessage',
        info: {messageId: '${translationMessageId}'},
      }),
    ),
  ],
};
