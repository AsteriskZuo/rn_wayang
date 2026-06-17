jest.mock('../src/FileHelper', () => ({
  FileHelper: {
    materializeFixture: jest.fn(),
    createWritablePath: jest.fn(),
  },
}));

jest.mock('react-native-chat-sdk', () => ({
  ChatClient: {
    getInstance: jest.fn(),
  },
  ChatGroupOptions: jest.fn(function ChatGroupOptions(
    this: any,
    options: any,
  ) {
    Object.assign(this, options);
  }),
}));

import {ChatClient} from 'react-native-chat-sdk';
import {FileHelper} from '../src/FileHelper';
import {BizChatGroupManager} from '../src/biz/BizChatGroupManager';

const mockedChatClient = ChatClient as jest.Mocked<typeof ChatClient>;
const mockedFileHelper = FileHelper as jest.Mocked<typeof FileHelper>;

function mockGroupManager(overrides: Record<string, jest.Mock> = {}) {
  const groupManager = {
    uploadGroupSharedFile: jest.fn(() => Promise.resolve(undefined)),
    downloadGroupSharedFile: jest.fn(() => Promise.resolve(undefined)),
    ...overrides,
  };
  mockedChatClient.getInstance.mockReturnValue({
    groupManager,
  } as any);
  return groupManager;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('BizChatGroupManager fixture-backed shared file transfers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFileHelper.materializeFixture.mockResolvedValue({
      filename: 'test-large-8mb.bin',
      localPath: '/documents/upload-fixtures/test-large-8mb.bin',
      filePath: '/documents/upload-fixtures/test-large-8mb.bin',
      metadata: {
        mimeType: 'application/octet-stream',
      },
    });
    mockedFileHelper.createWritablePath.mockResolvedValue({
      filename: 'downloaded-test-large-8mb.bin',
      savePath:
        '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
    });
  });

  test('uploadGroupSharedFile uses caller filePath before fixtureName', async () => {
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.uploadGroupSharedFile(
      {
        groupId: 'group-id',
        filePath: '/caller/file.bin',
        fixtureName: 'test-large-8mb.bin',
      },
      callback,
    );

    expect(mockedFileHelper.materializeFixture).not.toHaveBeenCalled();
    expect(groupManager.uploadGroupSharedFile).toHaveBeenCalledWith(
      'group-id',
      '/caller/file.bin',
      expect.objectContaining({
        onProgress: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
  });

  test('uploadGroupSharedFile materializes fixtureName when filePath is absent', async () => {
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.uploadGroupSharedFile(
      {
        groupId: 'group-id',
        fixtureName: 'test-large-8mb.bin',
      },
      callback,
    );

    expect(mockedFileHelper.materializeFixture).toHaveBeenCalledWith(
      'test-large-8mb.bin',
    );
    expect(groupManager.uploadGroupSharedFile).toHaveBeenCalledWith(
      'group-id',
      '/documents/upload-fixtures/test-large-8mb.bin',
      expect.any(Object),
    );
  });

  test('downloadGroupSharedFile uses caller savePath before saveFilename', async () => {
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.downloadGroupSharedFile(
      {
        groupId: 'group-id',
        fileId: 'file-id',
        savePath: '/caller/download.bin',
        saveFilename: 'downloaded-test-large-8mb.bin',
      },
      callback,
    );

    expect(mockedFileHelper.createWritablePath).not.toHaveBeenCalled();
    expect(groupManager.downloadGroupSharedFile).toHaveBeenCalledWith(
      'group-id',
      'file-id',
      '/caller/download.bin',
      expect.objectContaining({
        onProgress: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
  });

  test('downloadGroupSharedFile creates writable path when savePath is absent', async () => {
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.downloadGroupSharedFile(
      {
        groupId: 'group-id',
        fileId: 'file-id',
        saveFilename: 'downloaded-test-large-8mb.bin',
      },
      callback,
    );

    expect(mockedFileHelper.createWritablePath).toHaveBeenCalledWith(
      'downloaded-test-large-8mb.bin',
    );
    expect(groupManager.downloadGroupSharedFile).toHaveBeenCalledWith(
      'group-id',
      'file-id',
      '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
      expect.any(Object),
    );
  });

  test('uploadGroupSharedFile sends exactly one success callback', async () => {
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.uploadGroupSharedFile(
      {
        groupId: 'group-id',
        fixtureName: 'test-large-8mb.bin',
      },
      callback,
    );
    await flushPromises();
    const statusCallback = groupManager.uploadGroupSharedFile.mock.calls[0][2];

    statusCallback.onSuccess(
      'group-id',
      '/documents/upload-fixtures/test-large-8mb.bin',
    );
    statusCallback.onError(
      'group-id',
      '/documents/upload-fixtures/test-large-8mb.bin',
      {
        code: 1,
        description: 'late error',
      },
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
  });

  test('downloadGroupSharedFile sends exactly one SDK error callback', async () => {
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.downloadGroupSharedFile(
      {
        groupId: 'group-id',
        fileId: 'file-id',
        saveFilename: 'downloaded-test-large-8mb.bin',
      },
      callback,
    );
    await flushPromises();
    const statusCallback =
      groupManager.downloadGroupSharedFile.mock.calls[0][3];
    const error = {code: 404, description: 'missing file'};

    statusCallback.onError(
      'group-id',
      '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
      error,
    );
    statusCallback.onSuccess(
      'group-id',
      '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(error);
  });

  test('downloadGroupSharedFile sends exactly one success callback', async () => {
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.downloadGroupSharedFile(
      {
        groupId: 'group-id',
        fileId: 'file-id',
        saveFilename: 'downloaded-test-large-8mb.bin',
      },
      callback,
    );
    await flushPromises();
    const statusCallback =
      groupManager.downloadGroupSharedFile.mock.calls[0][3];
    const error = {code: 1, description: 'late download error'};

    statusCallback.onSuccess(
      'group-id',
      '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
    );
    statusCallback.onError(
      'group-id',
      '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
      error,
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
  });

  test('uploadGroupSharedFile returns preparation errors through callback', async () => {
    const error = new Error('unknown fixture');
    mockedFileHelper.materializeFixture.mockRejectedValue(error);
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.uploadGroupSharedFile(
      {
        groupId: 'group-id',
        fixtureName: 'missing.bin',
      },
      callback,
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(error);
    expect(groupManager.uploadGroupSharedFile).not.toHaveBeenCalled();
  });

  test('downloadGroupSharedFile returns writable path errors through callback', async () => {
    const error = new Error('unsafe filename');
    mockedFileHelper.createWritablePath.mockRejectedValue(error);
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.downloadGroupSharedFile(
      {
        groupId: 'group-id',
        fileId: 'file-id',
        saveFilename: '../escape.bin',
      },
      callback,
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(error);
    expect(groupManager.downloadGroupSharedFile).not.toHaveBeenCalled();
  });

  test(
    'uploadGroupSharedFile startup promise rejection wins over later transfer callback',
    async () => {
      const startupError = new Error('startup failed');
      const groupManager = mockGroupManager({
        uploadGroupSharedFile: jest.fn(() => Promise.reject(startupError)),
      });
      const callback = jest.fn();

      await BizChatGroupManager.uploadGroupSharedFile(
        {
          groupId: 'group-id',
          fixtureName: 'test-large-8mb.bin',
        },
        callback,
      );
      await flushPromises();
      const statusCallback =
        groupManager.uploadGroupSharedFile.mock.calls[0][2];
      statusCallback.onSuccess(
        'group-id',
        '/documents/upload-fixtures/test-large-8mb.bin',
      );

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(startupError);
    },
  );

  test(
    'downloadGroupSharedFile startup promise rejection wins over later transfer callback',
    async () => {
      const startupError = new Error('download startup failed');
      const groupManager = mockGroupManager({
        downloadGroupSharedFile: jest.fn(() => Promise.reject(startupError)),
      });
      const callback = jest.fn();

      await BizChatGroupManager.downloadGroupSharedFile(
        {
          groupId: 'group-id',
          fileId: 'file-id',
          saveFilename: 'downloaded-test-large-8mb.bin',
        },
        callback,
      );
      await flushPromises();
      const statusCallback =
        groupManager.downloadGroupSharedFile.mock.calls[0][3];
      statusCallback.onSuccess(
        'group-id',
        '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
      );

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(startupError);
    },
  );

  test(
    'uploadGroupSharedFile transfer callback wins over later startup promise rejection',
    async () => {
      let rejectStartup!: (error: Error) => void;
      const startupPromise = new Promise<undefined>((_, reject) => {
        rejectStartup = (error: Error) => reject(error);
      });
      const groupManager = mockGroupManager({
        uploadGroupSharedFile: jest.fn(() => startupPromise),
      });
      const callback = jest.fn();
      const transferError = {code: 500, description: 'transfer failed'};
      const startupError = new Error('late startup failure');

      BizChatGroupManager.uploadGroupSharedFile(
        {
          groupId: 'group-id',
          fixtureName: 'test-large-8mb.bin',
        },
        callback,
      );
      await flushPromises();
      const statusCallback =
        groupManager.uploadGroupSharedFile.mock.calls[0][2];

      statusCallback.onError(
        'group-id',
        '/documents/upload-fixtures/test-large-8mb.bin',
        transferError,
      );
      rejectStartup(startupError);
      await flushPromises();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(transferError);
    },
  );

  test(
    'downloadGroupSharedFile transfer callback wins over later startup promise rejection',
    async () => {
      let rejectStartup!: (error: Error) => void;
      const startupPromise = new Promise<undefined>((_, reject) => {
        rejectStartup = (error: Error) => reject(error);
      });
      const groupManager = mockGroupManager({
        downloadGroupSharedFile: jest.fn(() => startupPromise),
      });
      const callback = jest.fn();
      const transferError = {code: 500, description: 'download failed'};
      const startupError = new Error('late download startup failure');

      BizChatGroupManager.downloadGroupSharedFile(
        {
          groupId: 'group-id',
          fileId: 'file-id',
          saveFilename: 'downloaded-test-large-8mb.bin',
        },
        callback,
      );
      await flushPromises();
      const statusCallback =
        groupManager.downloadGroupSharedFile.mock.calls[0][3];

      statusCallback.onError(
        'group-id',
        '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
        transferError,
      );
      rejectStartup(startupError);
      await flushPromises();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(transferError);
    },
  );

  test('shared file transfer progress callbacks log only', async () => {
    const groupManager = mockGroupManager();
    const callback = jest.fn();

    await BizChatGroupManager.uploadGroupSharedFile(
      {
        groupId: 'group-id',
        fixtureName: 'test-large-8mb.bin',
      },
      callback,
    );
    const statusCallback = groupManager.uploadGroupSharedFile.mock.calls[0][2];
    statusCallback.onProgress(
      'group-id',
      '/documents/upload-fixtures/test-large-8mb.bin',
      50,
    );

    await BizChatGroupManager.downloadGroupSharedFile(
      {
        groupId: 'group-id',
        fileId: 'file-id',
        saveFilename: 'downloaded-test-large-8mb.bin',
      },
      callback,
    );
    const downloadStatusCallback =
      groupManager.downloadGroupSharedFile.mock.calls[0][3];
    downloadStatusCallback.onProgress(
      'group-id',
      '/documents/group-shared-downloads/downloaded-test-large-8mb.bin',
      75,
    );

    expect(callback).not.toHaveBeenCalled();
  });
});
