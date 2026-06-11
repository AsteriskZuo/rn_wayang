jest.mock('react-native-chat-sdk', () => ({
  ChatClient: {
    getInstance: jest.fn(),
  },
  ChatMessage: {},
}));

import {ChatClient} from 'react-native-chat-sdk';
import {BizChatManager} from '../src/biz/BizChatManager';

const mockedChatClient = ChatClient as jest.Mocked<typeof ChatClient>;

describe('BizChatManager response protocol behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createMessage unsupported puppet message type callbacks undefined and returns undefined', () => {
    const callback = jest.fn();

    const message = BizChatManager.createMessage({type: 'unsupported'}, callback);

    expect(message).toBeUndefined();
    expect(callback).toHaveBeenCalledWith(undefined);
  });

  test('sendMessage unsupported puppet message type callbacks undefined and skips SDK send', () => {
    const sendMessage = jest.fn();
    mockedChatClient.getInstance.mockReturnValue({
      chatManager: {
        sendMessage,
      },
    } as any);
    const callback = jest.fn();

    BizChatManager.sendMessage({type: 'unsupported'}, callback);

    expect(callback).toHaveBeenCalledWith(undefined);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('importMessages keeps unsupported message as undefined and calls SDK', async () => {
    const importMessages = jest.fn().mockResolvedValue('imported');
    mockedChatClient.getInstance.mockReturnValue({
      chatManager: {
        importMessages,
      },
    } as any);
    const callback = jest.fn();

    BizChatManager.importMessages(
      {data: [{type: 'unsupported'}]},
      callback,
    );

    expect(importMessages).toHaveBeenCalledWith([undefined]);
    await expect(importMessages.mock.results[0].value).resolves.toBe(
      'imported',
    );
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith('imported');
  });
});
