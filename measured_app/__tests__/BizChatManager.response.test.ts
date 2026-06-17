jest.mock('react-native-chat-sdk', () => ({
  ChatClient: {
    getInstance: jest.fn(),
  },
  ChatMessageChatType: {
    PeerChat: 0,
    GroupChat: 1,
    ChatRoom: 2,
  },
  ChatConversationType: {
    PeerChat: 0,
    GroupChat: 1,
    RoomChat: 2,
  },
  ChatMessage: {
    createTextMessage: jest.fn(() => ({id: 'created-text-message'})),
  },
}));

import {ChatClient, ChatMessage} from 'react-native-chat-sdk';
import {BizChatManager} from '../src/biz/BizChatManager';

const mockedChatClient = ChatClient as jest.Mocked<typeof ChatClient>;
const mockedChatMessage = ChatMessage as jest.Mocked<typeof ChatMessage>;

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

  test('insertMessage forwards caller message object without creating a new message', async () => {
    const insertMessage = jest.fn().mockResolvedValue('inserted');
    mockedChatClient.getInstance.mockReturnValue({
      chatManager: {
        insertMessage,
      },
    } as any);
    const callback = jest.fn();
    const message = {msgId: 'jmeter-message'};

    BizChatManager.insertMessage({message}, callback);

    expect(mockedChatMessage.createTextMessage).not.toHaveBeenCalled();
    expect(insertMessage).toHaveBeenCalledWith(message);
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith('inserted');
  });

  test('updateMessage forwards caller message object without creating a new message', async () => {
    const updateMessage = jest.fn().mockResolvedValue('updated');
    mockedChatClient.getInstance.mockReturnValue({
      chatManager: {
        updateMessage,
      },
    } as any);
    const callback = jest.fn();
    const message = {msgId: 'jmeter-message'};

    BizChatManager.updateMessage({message}, callback);

    expect(mockedChatMessage.createTextMessage).not.toHaveBeenCalled();
    expect(updateMessage).toHaveBeenCalledWith(message);
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith('updated');
  });

  test('updateConversationMessage forwards caller message object without creating a new message', async () => {
    const updateConversationMessage = jest.fn().mockResolvedValue('updated');
    mockedChatClient.getInstance.mockReturnValue({
      chatManager: {
        updateConversationMessage,
      },
    } as any);
    const callback = jest.fn();
    const message = {msgId: 'jmeter-message'};

    await BizChatManager.updateConversationMessage(
      {
        conversationId: 'conv',
        conversationType: 'PeerChat',
        message,
      },
      callback,
    );

    expect(mockedChatMessage.createTextMessage).not.toHaveBeenCalled();
    expect(updateConversationMessage).toHaveBeenCalledWith(
      'conv',
      expect.anything(),
      message,
      undefined,
    );
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith('updated');
  });

  test('importMessages forwards caller message objects without creating new messages', async () => {
    const importMessages = jest.fn().mockResolvedValue('imported');
    mockedChatClient.getInstance.mockReturnValue({
      chatManager: {
        importMessages,
      },
    } as any);
    const callback = jest.fn();
    const messages = [{msgId: 'jmeter-message-1'}, {msgId: 'jmeter-message-2'}];

    BizChatManager.importMessages({messages}, callback);

    expect(mockedChatMessage.createTextMessage).not.toHaveBeenCalled();
    expect(importMessages).toHaveBeenCalledWith(messages);
    await expect(importMessages.mock.results[0].value).resolves.toBe(
      'imported',
    );
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith('imported');
  });
});
