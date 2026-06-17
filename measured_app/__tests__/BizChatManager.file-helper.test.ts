jest.mock('../src/FileHelper', () => ({
  FileHelper: {
    materializeFixture: jest.fn(),
  },
}));

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
    GroupChat: 1,
    RoomChat: 2,
  },
  ChatSearchDirection: {
    UP: 0,
    DOWN: 1,
  },
  ChatConversationMarkType: {
    Type0: 0,
  },
  ChatMessage: {
    createTextMessage: jest.fn(() => ({id: 'text-message'})),
    createImageMessage: jest.fn(() => ({id: 'image-message'})),
    createVideoMessage: jest.fn(() => ({id: 'video-message'})),
    createVoiceMessage: jest.fn(() => ({id: 'voice-message'})),
    createFileMessage: jest.fn(() => ({id: 'file-message'})),
    createLocationMessage: jest.fn(() => ({id: 'location-message'})),
    createCmdMessage: jest.fn(() => ({id: 'cmd-message'})),
    createCustomMessage: jest.fn(() => ({id: 'custom-message'})),
  },
}));

import {ChatClient, ChatMessage} from 'react-native-chat-sdk';
import {FileHelper} from '../src/FileHelper';
import {BizChatManager} from '../src/biz/BizChatManager';

type SendMessageMock = jest.Mock<
  Promise<void>,
  [unknown, {onProgress: Function; onError: Function; onSuccess: Function}]
>;

const mockedChatClient = ChatClient as jest.Mocked<typeof ChatClient>;
const mockedChatMessage = ChatMessage as jest.Mocked<typeof ChatMessage>;
const mockedFileHelper = FileHelper as jest.Mocked<typeof FileHelper>;

function mockSendMessage(): SendMessageMock {
  const sendMessage = jest.fn<
    ReturnType<SendMessageMock>,
    Parameters<SendMessageMock>
  >(() => Promise.resolve(undefined));
  mockedChatClient.getInstance.mockReturnValue({
    chatManager: {
      sendMessage,
    },
  } as any);
  return sendMessage;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('BizChatManager fixture-backed sendMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFileHelper.materializeFixture.mockResolvedValue({
      filename: 'test-image.jpg',
      localPath: '/documents/upload-fixtures/test-image.jpg',
      filePath: '/documents/upload-fixtures/test-image.jpg',
      metadata: {
        mimeType: 'image/jpeg',
        width: 640,
        height: 360,
      },
    });
  });

  test('sendMessage uses caller localPath before fixtureName', async () => {
    const sendMessage = mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        localPath: '/caller/image.jpg',
        fixtureName: 'test-image.jpg',
        width: 320,
        height: 180,
      },
      callback,
    );

    expect(mockedFileHelper.materializeFixture).not.toHaveBeenCalled();
    expect(mockedChatMessage.createImageMessage).toHaveBeenCalled();
    expect(mockedChatMessage.createImageMessage.mock.calls[0].slice(0, 3))
      .toEqual(['target-user', '/caller/image.jpg', 0]);
    expect(sendMessage).toHaveBeenCalledWith(
      {id: 'image-message'},
      expect.objectContaining({
        onProgress: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
    expect(callback).not.toHaveBeenCalled();
  });

  test('sendMessage does not materialize fixtureName for unsupported messages', async () => {
    const sendMessage = mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'unsupported',
        fixtureName: 'missing.jpg',
      },
      callback,
    );

    expect(mockedFileHelper.materializeFixture).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(undefined);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('sendMessage does not materialize fixtureName for text messages', async () => {
    const sendMessage = mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'text',
        username: 'target-user',
        content: 'hello',
        fixtureName: 'missing.jpg',
      },
      callback,
    );

    expect(mockedFileHelper.materializeFixture).not.toHaveBeenCalled();
    expect(mockedChatMessage.createTextMessage).toHaveBeenCalledWith(
      'target-user',
      'hello',
      0,
      expect.objectContaining({
        isChatThread: false,
      }),
    );
    expect(sendMessage).toHaveBeenCalledWith(
      {id: 'text-message'},
      expect.objectContaining({
        onProgress: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
  });

  test('sendMessage creates text message with requested conversationType', async () => {
    const sendMessage = mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'text',
        username: 'target-group',
        content: 'hello group',
        conversationType: 'GroupChat',
      },
      callback,
    );

    expect(mockedChatMessage.createTextMessage).toHaveBeenCalledWith(
      'target-group',
      'hello group',
      1,
      expect.objectContaining({
        isChatThread: false,
      }),
    );
    expect(sendMessage).toHaveBeenCalledWith(
      {id: 'text-message'},
      expect.objectContaining({
        onProgress: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
  });

  test('sendMessage ignores chatType when resolving conversation type', async () => {
    mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'text',
        username: 'target-user',
        content: 'hello peer',
        chatType: 'GroupChat',
      },
      callback,
    );

    expect(mockedChatMessage.createTextMessage).toHaveBeenCalledWith(
      'target-user',
      'hello peer',
      0,
      expect.objectContaining({
        isChatThread: false,
      }),
    );
  });

  test('sendMessage preserves plain image factory arguments', async () => {
    mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        localPath: '/caller/image.jpg',
      },
      callback,
    );

    expect(mockedChatMessage.createImageMessage).toHaveBeenCalledWith(
      'target-user',
      '/caller/image.jpg',
      0,
    );
    expect(mockedChatMessage.createImageMessage.mock.calls[0]).toHaveLength(3);
  });

  test('sendMessage materializes fixtureName when localPath is absent', async () => {
    mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        fixtureName: 'test-image.jpg',
      },
      callback,
    );

    expect(mockedFileHelper.materializeFixture).toHaveBeenCalledWith(
      'test-image.jpg',
    );
    expect(mockedChatMessage.createImageMessage).toHaveBeenCalledWith(
      'target-user',
      '/documents/upload-fixtures/test-image.jpg',
      0,
      expect.objectContaining({
        width: 640,
        height: 360,
      }),
    );
  });

  test('sendMessage supports file attachment messages', async () => {
    mockedFileHelper.materializeFixture.mockResolvedValue({
      filename: 'test-file.txt',
      localPath: '/documents/upload-fixtures/test-file.txt',
      filePath: '/documents/upload-fixtures/test-file.txt',
      metadata: {
        mimeType: 'text/plain',
      },
    });
    mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'file',
        username: 'target-user',
        fixtureName: 'test-file.txt',
        displayName: 'test-file.txt',
      },
      callback,
    );

    expect(mockedChatMessage.createFileMessage).toHaveBeenCalledWith(
      'target-user',
      '/documents/upload-fixtures/test-file.txt',
      0,
      expect.objectContaining({
        displayName: 'test-file.txt',
      }),
    );
  });

  test('sendMessage applies video fixture metadata while preserving explicit thumbnailLocalPath', async () => {
    mockedFileHelper.materializeFixture.mockResolvedValue({
      filename: 'test-video.mp4',
      localPath: '/documents/upload-fixtures/test-video.mp4',
      filePath: '/documents/upload-fixtures/test-video.mp4',
      metadata: {
        mimeType: 'video/mp4',
        width: 640,
        height: 360,
        duration: 3,
      },
    });
    mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'video',
        username: 'target-user',
        fixtureName: 'test-video.mp4',
        thumbnailLocalPath: '/caller/thumb.jpg',
      },
      callback,
    );

    expect(mockedFileHelper.materializeFixture).toHaveBeenCalledWith(
      'test-video.mp4',
    );
    expect(mockedChatMessage.createVideoMessage).toHaveBeenCalledWith(
      'target-user',
      '/documents/upload-fixtures/test-video.mp4',
      0,
      expect.objectContaining({
        thumbnailLocalPath: '/caller/thumb.jpg',
        width: 640,
        height: 360,
        duration: 3,
      }),
    );
  });

  test('sendMessage sends exactly one callback when SDK reports success after startup promise resolves', async () => {
    const sendMessage = mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        fixtureName: 'test-image.jpg',
      },
      callback,
    );
    await flushPromises();
    const statusCallback = sendMessage.mock.calls[0][1];

    statusCallback.onSuccess({id: 'server-message'});
    statusCallback.onError('local-id', {code: 1, description: 'late error'});

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({id: 'server-message'});
  });

  test('sendMessage sends exactly one callback when SDK reports transfer error after startup promise resolves', async () => {
    const sendMessage = mockSendMessage();
    const callback = jest.fn();
    const error = {code: 1, description: 'transfer failed'};

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        fixtureName: 'test-image.jpg',
      },
      callback,
    );
    await flushPromises();
    const statusCallback = sendMessage.mock.calls[0][1];

    statusCallback.onError('local-id', error);
    statusCallback.onSuccess({id: 'late-success'});

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(error);
  });

  test('sendMessage sends exactly one callback when transfer error is followed by startup rejection', async () => {
    let rejectStartup!: (error: Error) => void;
    const startupPromise = new Promise<void>((_, reject) => {
      rejectStartup = reject;
    });
    const sendMessage = jest.fn<
      ReturnType<SendMessageMock>,
      Parameters<SendMessageMock>
    >(() => startupPromise);
    mockedChatClient.getInstance.mockReturnValue({
      chatManager: {
        sendMessage,
      },
    } as any);
    const callback = jest.fn();
    const transferError = {code: 1, description: 'transfer failed'};
    const startupError = new Error('startup failed');

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        fixtureName: 'test-image.jpg',
      },
      callback,
    );
    await flushPromises();
    const statusCallback = sendMessage.mock.calls[0][1];

    statusCallback.onError('local-id', transferError);
    rejectStartup(startupError);
    await flushPromises();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(transferError);
  });

  test('sendMessage sends exactly one callback when SDK startup promise rejects before transfer callback', async () => {
    const startupError = new Error('startup failed');
    const sendMessage = jest.fn<
      ReturnType<SendMessageMock>,
      Parameters<SendMessageMock>
    >(() => Promise.reject(startupError));
    mockedChatClient.getInstance.mockReturnValue({
      chatManager: {
        sendMessage,
      },
    } as any);
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        fixtureName: 'test-image.jpg',
      },
      callback,
    );
    await flushPromises();
    const statusCallback = sendMessage.mock.calls[0][1];
    statusCallback.onSuccess({id: 'late-success'});

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(startupError);
  });

  test('sendMessage returns fixture preparation errors through callback', async () => {
    const error = new Error('unknown fixture');
    mockedFileHelper.materializeFixture.mockRejectedValue(error);
    const sendMessage = mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        fixtureName: 'missing.jpg',
      },
      callback,
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(error);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('sendMessage progress callback logs only', async () => {
    const sendMessage = mockSendMessage();
    const callback = jest.fn();

    await BizChatManager.sendMessage(
      {
        type: 'image',
        username: 'target-user',
        fixtureName: 'test-image.jpg',
      },
      callback,
    );
    const statusCallback = sendMessage.mock.calls[0][1];
    statusCallback.onProgress('local-id', 50);

    expect(callback).not.toHaveBeenCalled();
  });
});
