# File Helper Fixture Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bundled upload fixtures, a `FileHelper` utility, and wrapper support so JMeter can use stable fixture names and generated download filenames instead of platform-specific native paths.

**Architecture:** Keep file path resolution inside `measured_app` and expose it only through existing SDK wrapper inputs: `fixtureName` for upload/send paths and `saveFilename` for group shared file downloads. `FileHelper` owns fixture validation, Android asset copying, iOS bundle copying, writable download path creation, and fixture metadata; Biz wrappers remain thin and return exactly one callback response for SDK success, SDK error, or preparation failure.

**Tech Stack:** React Native 0.83 TypeScript, `react-native-fs`, `react-native-chat-sdk`, Jest, Android assets, iOS Xcode resources, Yarn Berry.

---

## File Map

- Create: `measured_app/src/FileHelper.ts`
  - Owns fixture whitelist, metadata, safe filename validation, native fixture materialization, and writable save path generation.
- Create: `measured_app/__tests__/FileHelper.test.ts`
  - Unit tests validation, platform-specific source handling, destination cleanup, and metadata without native runtime dependencies.
- Create: `measured_app/__tests__/BizChatManager.file-helper.test.ts`
  - Tests `sendMessage` path precedence, fixture materialization, file message creation, metadata application, and one-shot callback behavior.
- Create: `measured_app/__tests__/BizChatGroupManager.file-helper.test.ts`
  - Tests group shared upload/download path precedence, fixture/save-name resolution, progress logging behavior, startup failure, and one-shot callback behavior.
- Modify: `measured_app/src/biz/BizChatManager.ts`
  - Imports `FileHelper`, resolves `fixtureName` when `localPath` is absent, supports `file` messages, applies fixture metadata where caller fields are absent, and guards `sendMessage` callback.
- Modify: `measured_app/src/biz/BizChatGroupManager.ts`
  - Imports `FileHelper` and SDK file status types, replaces current shared-file placeholders with real upload/download wrappers, and guards each transfer callback.
- Create fixture files under: `measured_app/android/app/src/main/assets/upload-fixtures/`
  - Android APK assets copied by `RNFS.copyFileAssets`.
- Create fixture files under: `measured_app/ios/rn_wayang/upload-fixtures/`
  - iOS bundle resources copied from `${RNFS.MainBundlePath}/upload-fixtures/<filename>`.
- Modify: `measured_app/ios/rn_wayang.xcodeproj/project.pbxproj`
  - Adds `upload-fixtures` as a folder reference in the app target Copy Bundle Resources so the runtime directory is preserved.
- Verify, but only modify if dependency is missing: `measured_app/package.json`, `measured_app/yarn.lock`
  - `react-native-fs` is required by the helper. If it is already present, leave these files untouched.

## Execution Guardrails

- User constraint: all implementation tasks are committed together in one final git commit. Do not commit per task.
- Do not change `react-native-chat-sdk` public APIs.
- Do not expose `FileHelper` as a WebSocket command or generated dispatch route.
- Do not choose default fixture files when `localPath`, `filePath`, `savePath`, `fixtureName`, or `saveFilename` are absent.
- Path fields take precedence over fixture fields:
  - `localPath` beats `fixtureName` in `ChatManager.sendMessage`.
  - `filePath` beats `fixtureName` in `ChatGroupManager.uploadGroupSharedFile`.
  - `savePath` beats `saveFilename` in `ChatGroupManager.downloadGroupSharedFile`.
- Progress callbacks log only. They must never call the WebSocket callback.
- Wrappers touched by this plan must invoke the supplied callback exactly once for each command.
- `FileHelper` rejects unsupported platforms with an `Error` naming the platform.
- Generated dispatch routes should not change for this feature. If `yarn generate:dispatch` changes generated files, review the diff before continuing.
- Existing user changes in unrelated files must be preserved. If `package.json` or `yarn.lock` already contain `react-native-fs`, do not rewrite dependency metadata.

## Task 1: Add FileHelper Unit Tests

**Files:**
- Create: `measured_app/__tests__/FileHelper.test.ts`

- [ ] **Step 1: Write failing FileHelper tests**

Create `measured_app/__tests__/FileHelper.test.ts`:

```typescript
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/documents',
  MainBundlePath: '/main-bundle',
  mkdir: jest.fn(() => Promise.resolve()),
  exists: jest.fn(() => Promise.resolve(false)),
  unlink: jest.fn(() => Promise.resolve()),
  copyFile: jest.fn(() => Promise.resolve()),
  copyFileAssets: jest.fn(() => Promise.resolve()),
}));

import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {FileHelper} from '../src/FileHelper';

const mockedPlatform = Platform as typeof Platform & {OS: string};
const mockedRNFS = RNFS as jest.Mocked<typeof RNFS>;

describe('FileHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPlatform.OS = 'android';
    mockedRNFS.exists.mockResolvedValue(false);
  });

  test('fixtureNames exposes the committed fixture whitelist', () => {
    expect(FileHelper.fixtureNames).toEqual([
      'test-image.jpg',
      'test-audio.m4a',
      'test-video.mp4',
      'test-file.txt',
      'test-large-8mb.bin',
    ]);
  });

  test('isFixtureName accepts only committed fixture names', () => {
    expect(FileHelper.isFixtureName('test-image.jpg')).toBe(true);
    expect(FileHelper.isFixtureName('test-large-8mb.bin')).toBe(true);
    expect(FileHelper.isFixtureName('missing.jpg')).toBe(false);
    expect(FileHelper.isFixtureName('../test-image.jpg')).toBe(false);
  });

  test('assertSafeFilename accepts a plain file name', () => {
    expect(() => FileHelper.assertSafeFilename('downloaded-test-file.txt')).not.toThrow();
  });

  test.each([
    '',
    '.',
    '..',
    '/absolute.txt',
    'nested/file.txt',
    'nested\\file.txt',
    '../escape.txt',
    'escape/../file.txt',
  ])('assertSafeFilename rejects unsafe name %p', unsafeName => {
    expect(() => FileHelper.assertSafeFilename(unsafeName)).toThrow(
      /unsafe filename/i,
    );
  });

  test('materializeFixture copies Android APK asset to document directory', async () => {
    mockedRNFS.exists.mockResolvedValue(true);

    const result = await FileHelper.materializeFixture('test-image.jpg');

    expect(mockedRNFS.mkdir).toHaveBeenCalledWith('/documents/upload-fixtures');
    expect(mockedRNFS.exists).toHaveBeenCalledWith(
      '/documents/upload-fixtures/test-image.jpg',
    );
    expect(mockedRNFS.unlink).toHaveBeenCalledWith(
      '/documents/upload-fixtures/test-image.jpg',
    );
    expect(mockedRNFS.copyFileAssets).toHaveBeenCalledWith(
      'upload-fixtures/test-image.jpg',
      '/documents/upload-fixtures/test-image.jpg',
    );
    expect(mockedRNFS.copyFile).not.toHaveBeenCalled();
    expect(result).toEqual({
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

  test('materializeFixture copies iOS bundle file to document directory', async () => {
    mockedPlatform.OS = 'ios';

    const result = await FileHelper.materializeFixture('test-audio.m4a');

    expect(mockedRNFS.mkdir).toHaveBeenCalledWith('/documents/upload-fixtures');
    expect(mockedRNFS.copyFile).toHaveBeenCalledWith(
      '/main-bundle/upload-fixtures/test-audio.m4a',
      '/documents/upload-fixtures/test-audio.m4a',
    );
    expect(mockedRNFS.copyFileAssets).not.toHaveBeenCalled();
    expect(result).toEqual({
      filename: 'test-audio.m4a',
      localPath: '/documents/upload-fixtures/test-audio.m4a',
      filePath: '/documents/upload-fixtures/test-audio.m4a',
      metadata: {
        mimeType: 'audio/mp4',
        duration: 3,
      },
    });
  });

  test('materializeFixture rejects unknown fixture names', async () => {
    await expect(FileHelper.materializeFixture('missing.txt')).rejects.toThrow(
      /unknown fixture/i,
    );
    expect(mockedRNFS.mkdir).not.toHaveBeenCalled();
  });

  test('materializeFixture rejects unsupported platforms explicitly', async () => {
    mockedPlatform.OS = 'windows';

    await expect(
      FileHelper.materializeFixture('test-file.txt'),
    ).rejects.toThrow(/unsupported platform: windows/i);
  });

  test('createWritablePath removes an existing target and returns savePath without creating a file', async () => {
    mockedRNFS.exists.mockResolvedValue(true);

    const result = await FileHelper.createWritablePath('downloaded-test-file.txt');

    expect(mockedRNFS.mkdir).toHaveBeenCalledWith(
      '/documents/group-shared-downloads',
    );
    expect(mockedRNFS.exists).toHaveBeenCalledWith(
      '/documents/group-shared-downloads/downloaded-test-file.txt',
    );
    expect(mockedRNFS.unlink).toHaveBeenCalledWith(
      '/documents/group-shared-downloads/downloaded-test-file.txt',
    );
    expect(mockedRNFS.copyFile).not.toHaveBeenCalled();
    expect(mockedRNFS.copyFileAssets).not.toHaveBeenCalled();
    expect(result).toEqual({
      filename: 'downloaded-test-file.txt',
      savePath: '/documents/group-shared-downloads/downloaded-test-file.txt',
    });
  });
});
```

- [ ] **Step 2: Run FileHelper tests and verify they fail**

Run:

```bash
cd measured_app
yarn test __tests__/FileHelper.test.ts
```

Expected: FAIL because `../src/FileHelper` does not exist.

## Task 2: Implement FileHelper

**Files:**
- Create: `measured_app/src/FileHelper.ts`
- Test: `measured_app/__tests__/FileHelper.test.ts`

- [ ] **Step 1: Create FileHelper**

Create `measured_app/src/FileHelper.ts`:

```typescript
import {Platform} from 'react-native';
import RNFS from 'react-native-fs';

export type FixtureName =
  | 'test-image.jpg'
  | 'test-audio.m4a'
  | 'test-video.mp4'
  | 'test-file.txt'
  | 'test-large-8mb.bin';

export type FixtureMetadata = {
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailLocalPath?: string;
};

export type FixturePath = {
  filename: FixtureName;
  localPath: string;
  filePath: string;
  metadata?: FixtureMetadata;
};

export type WritablePath = {
  filename: string;
  savePath: string;
};

const fixtureMetadata: Record<FixtureName, FixtureMetadata> = {
  'test-image.jpg': {
    mimeType: 'image/jpeg',
    width: 640,
    height: 360,
  },
  'test-audio.m4a': {
    mimeType: 'audio/mp4',
    duration: 3,
  },
  'test-video.mp4': {
    mimeType: 'video/mp4',
    width: 640,
    height: 360,
    duration: 3,
  },
  'test-file.txt': {
    mimeType: 'text/plain',
  },
  'test-large-8mb.bin': {
    mimeType: 'application/octet-stream',
  },
};

export class FileHelper {
  static readonly fixtureDirName = 'upload-fixtures';
  static readonly downloadDirName = 'group-shared-downloads';
  static readonly fixtureNames: readonly FixtureName[] = [
    'test-image.jpg',
    'test-audio.m4a',
    'test-video.mp4',
    'test-file.txt',
    'test-large-8mb.bin',
  ];

  static async materializeFixture(filename: string): Promise<FixturePath> {
    if (!this.isFixtureName(filename)) {
      throw new Error(`unknown fixture: ${filename}`);
    }

    const fixtureDir = `${RNFS.DocumentDirectoryPath}/${this.fixtureDirName}`;
    const destPath = `${fixtureDir}/${filename}`;

    await RNFS.mkdir(fixtureDir);
    await this.removeIfExists(destPath);

    if (Platform.OS === 'android') {
      await RNFS.copyFileAssets(`${this.fixtureDirName}/${filename}`, destPath);
    } else if (Platform.OS === 'ios') {
      await RNFS.copyFile(
        `${RNFS.MainBundlePath}/${this.fixtureDirName}/${filename}`,
        destPath,
      );
    } else {
      throw new Error(`unsupported platform: ${Platform.OS}`);
    }

    return {
      filename,
      localPath: destPath,
      filePath: destPath,
      metadata: fixtureMetadata[filename],
    };
  }

  static async createWritablePath(filename: string): Promise<WritablePath> {
    this.assertSafeFilename(filename);

    const downloadDir = `${RNFS.DocumentDirectoryPath}/${this.downloadDirName}`;
    const savePath = `${downloadDir}/${filename}`;

    await RNFS.mkdir(downloadDir);
    await this.removeIfExists(savePath);

    return {
      filename,
      savePath,
    };
  }

  static isFixtureName(filename: string): filename is FixtureName {
    return this.fixtureNames.includes(filename as FixtureName);
  }

  static assertSafeFilename(filename: string): void {
    if (
      filename.length === 0 ||
      filename === '.' ||
      filename === '..' ||
      filename.startsWith('/') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      throw new Error(`unsafe filename: ${filename}`);
    }
  }

  private static async removeIfExists(path: string): Promise<void> {
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  }
}
```

- [ ] **Step 2: Run FileHelper tests and verify they pass**

Run:

```bash
cd measured_app
yarn test __tests__/FileHelper.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run lint for new helper**

Run:

```bash
cd measured_app
yarn lint
```

Expected: PASS. If ESLint flags line wrapping in the test, reformat the affected lines without changing behavior.

## Task 3: Add BizChatManager Tests for Fixture-backed Attachments

**Files:**
- Create: `measured_app/__tests__/BizChatManager.file-helper.test.ts`
- Later modify: `measured_app/src/biz/BizChatManager.ts`

- [ ] **Step 1: Write failing BizChatManager attachment tests**

Create `measured_app/__tests__/BizChatManager.file-helper.test.ts`:

```typescript
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

const mockedChatClient = ChatClient as jest.Mocked<typeof ChatClient>;
const mockedChatMessage = ChatMessage as jest.Mocked<typeof ChatMessage>;
const mockedFileHelper = FileHelper as jest.Mocked<typeof FileHelper>;

function mockSendMessage() {
  const sendMessage = jest.fn(() => Promise.resolve(undefined));
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
    expect(mockedChatMessage.createImageMessage).toHaveBeenCalledWith(
      'target-user',
      '/caller/image.jpg',
      0,
      expect.objectContaining({
        width: 320,
        height: 180,
      }),
    );
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

  test('sendMessage sends exactly one callback when SDK startup promise rejects before transfer callback', async () => {
    const startupError = new Error('startup failed');
    const sendMessage = jest.fn(() => Promise.reject(startupError));
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
```

- [ ] **Step 2: Run BizChatManager attachment tests and verify they fail**

Run:

```bash
cd measured_app
yarn test __tests__/BizChatManager.file-helper.test.ts
```

Expected: FAIL because `BizChatManager.sendMessage` does not materialize `fixtureName`, does not support `file`, and does not guard duplicate callbacks.

## Task 4: Implement Fixture-backed BizChatManager Send

**Files:**
- Modify: `measured_app/src/biz/BizChatManager.ts`
- Test: `measured_app/__tests__/BizChatManager.file-helper.test.ts`
- Existing test to keep passing: `measured_app/__tests__/BizChatManager.response.test.ts`

- [ ] **Step 1: Add FileHelper import**

Modify the imports at the top of `measured_app/src/biz/BizChatManager.ts`:

```typescript
import {FileHelper, FixtureMetadata} from '../FileHelper';
```

- [ ] **Step 2: Add one-shot callback helper inside BizChatManager**

Add this static method near the existing helper methods in `BizChatManager`:

```typescript
  static createOneShotCallback(callback: ReturnCallback): ReturnCallback {
    let called = false;
    return value => {
      if (called) {
        return;
      }
      called = true;
      callback(value);
    };
  }
```

- [ ] **Step 3: Add attachment preparation helpers**

Add these methods before `createMessage`:

```typescript
  static mergeFixtureMetadata(info: any, metadata?: FixtureMetadata): any {
    if (metadata === undefined) {
      return info;
    }
    return {
      ...info,
      width: info.width ?? metadata.width,
      height: info.height ?? metadata.height,
      duration: info.duration ?? metadata.duration,
      thumbnailLocalPath:
        info.thumbnailLocalPath ?? metadata.thumbnailLocalPath,
    };
  }

  static async prepareMessageInfo(info: any): Promise<any> {
    if (info.localPath !== undefined) {
      return info;
    }
    if (info.fixtureName === undefined) {
      return info;
    }

    const fixture = await FileHelper.materializeFixture(info.fixtureName);
    const preparedInfo = this.mergeFixtureMetadata(
      {
        ...info,
        localPath: fixture.localPath,
      },
      fixture.metadata,
    );

    return preparedInfo;
  }
```

- [ ] **Step 4: Update image message creation to pass metadata options**

Replace the current `image` branch in `createMessage` with:

```typescript
    } else if (type === 'image') {
      const filePath = info.localPath;
      const displayName = info.displayName;
      const thumbnailLocalPath = info.thumbnailLocalPath;
      const sendOriginalImage = info.sendOriginalImage;
      const width = info.width;
      const height = info.height;
      const isChatThread = info.isChatThread ?? false;
      const fileSize = info.fileSize;
      const isOnline = info.isOnline;
      const deliverOnlineOnly = info.deliverOnlineOnly;
      const receiverList = this.splitList(info.receiverList);
      const isGif = info.isGif;
      message = ChatMessage.createImageMessage(
        targetId,
        filePath,
        ChatMessageChatType.PeerChat,
        {
          displayName,
          thumbnailLocalPath,
          sendOriginalImage,
          width,
          height,
          isChatThread,
          fileSize,
          isOnline,
          deliverOnlineOnly,
          receiverList,
          isGif,
        },
      );
```

- [ ] **Step 5: Add file message creation branch**

Add this branch after the `voice` branch and before `location`:

```typescript
    } else if (type === 'file') {
      const filePath = info.localPath;
      const displayName = info.displayName;
      const isChatThread = info.isChatThread ?? false;
      const fileSize = info.fileSize;
      const isOnline = info.isOnline;
      const deliverOnlineOnly = info.deliverOnlineOnly;
      const receiverList = this.splitList(info.receiverList);
      message = ChatMessage.createFileMessage(
        targetId,
        filePath,
        ChatMessageChatType.PeerChat,
        {
          displayName,
          isChatThread,
          fileSize,
          isOnline,
          deliverOnlineOnly,
          receiverList,
        },
      );
```

- [ ] **Step 6: Replace sendMessage with async fixture-aware one-shot implementation**

Replace the current `sendMessage` method with:

```typescript
  static async sendMessage(info: any, callback: ReturnCallback) {
    const once = this.createOneShotCallback(callback);
    let preparedInfo;
    try {
      preparedInfo = await this.prepareMessageInfo(info);
    } catch (error) {
      once(error);
      return;
    }

    const msg = this.createMessage(preparedInfo, once);
    if (msg === undefined) {
      return;
    }

    ChatClient.getInstance()
      .chatManager.sendMessage(
        msg,
        new (class implements ChatMessageStatusCallback {
          onProgress(localMsgId: string, progress: number): void {
            console.log(this.onProgress.name, localMsgId, progress);
          }
          onError(localMsgId: string, error: ChatError): void {
            console.log(this.onError.name, localMsgId, error);
            once(error);
          }
          onSuccess(message: ChatMessage): void {
            console.log(this.onSuccess.name, message);
            once(message);
          }
        })(),
      )
      .catch(error => {
        once(error);
      });
  }
```

- [ ] **Step 7: Run BizChatManager attachment tests**

Run:

```bash
cd measured_app
yarn test __tests__/BizChatManager.file-helper.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run existing BizChatManager response tests**

Run:

```bash
cd measured_app
yarn test __tests__/BizChatManager.response.test.ts
```

Expected: PASS. This confirms unsupported message handling still callbacks `undefined` and skips SDK send.

## Task 5: Add BizChatGroupManager Tests for Shared File Transfers

**Files:**
- Create: `measured_app/__tests__/BizChatGroupManager.file-helper.test.ts`
- Later modify: `measured_app/src/biz/BizChatGroupManager.ts`

- [ ] **Step 1: Write failing group shared file tests**

Create `measured_app/__tests__/BizChatGroupManager.file-helper.test.ts`:

```typescript
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
  ChatGroupOptions: jest.fn(function ChatGroupOptions(this: any, options: any) {
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

    statusCallback.onSuccess('group-id', '/documents/upload-fixtures/test-large-8mb.bin');
    statusCallback.onError('group-id', '/documents/upload-fixtures/test-large-8mb.bin', {
      code: 1,
      description: 'late error',
    });

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

  test('uploadGroupSharedFile startup promise rejection wins over later transfer callback', async () => {
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
    const statusCallback = groupManager.uploadGroupSharedFile.mock.calls[0][2];
    statusCallback.onSuccess('group-id', '/documents/upload-fixtures/test-large-8mb.bin');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(startupError);
  });

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
    statusCallback.onProgress('group-id', '/documents/upload-fixtures/test-large-8mb.bin', 50);

    expect(callback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run group shared file tests and verify they fail**

Run:

```bash
cd measured_app
yarn test __tests__/BizChatGroupManager.file-helper.test.ts
```

Expected: FAIL because the wrappers are still placeholders and do not use `FileHelper`.

## Task 6: Implement Shared File Upload and Download Wrappers

**Files:**
- Modify: `measured_app/src/biz/BizChatGroupManager.ts`
- Test: `measured_app/__tests__/BizChatGroupManager.file-helper.test.ts`

- [ ] **Step 1: Update imports**

Replace the import block at the top of `measured_app/src/biz/BizChatGroupManager.ts` with:

```typescript
import {
  ChatClient,
  ChatError,
  ChatGroupEventListener,
  ChatGroupFileStatusCallback,
  ChatGroupOptions,
} from 'react-native-chat-sdk';
import {FileHelper} from '../FileHelper';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';
```

- [ ] **Step 2: Add one-shot callback helper inside BizChatGroupManager**

Add this static method near the existing helper methods in `BizChatGroupManager`:

```typescript
  static createOneShotCallback(callback: ReturnCallback): ReturnCallback {
    let called = false;
    return value => {
      if (called) {
        return;
      }
      called = true;
      callback(value);
    };
  }
```

- [ ] **Step 3: Add path preparation helpers**

Add these methods before `createGroupEx`:

```typescript
  static async resolveUploadFilePath(info: any): Promise<string> {
    if (info.filePath !== undefined) {
      return info.filePath;
    }
    if (info.fixtureName !== undefined) {
      const fixture = await FileHelper.materializeFixture(info.fixtureName);
      return fixture.filePath;
    }
    return info.filePath;
  }

  static async resolveDownloadSavePath(info: any): Promise<string> {
    if (info.savePath !== undefined) {
      return info.savePath;
    }
    if (info.saveFilename !== undefined) {
      const writablePath = await FileHelper.createWritablePath(
        info.saveFilename,
      );
      return writablePath.savePath;
    }
    return info.savePath;
  }
```

- [ ] **Step 4: Replace uploadGroupSharedFile placeholder**

Replace the current `uploadGroupSharedFile` method with:

```typescript
  static async uploadGroupSharedFile(info: any, callback: ReturnCallback) {
    const once = this.createOneShotCallback(callback);
    const groupId = info.groupId;
    let filePath;
    try {
      filePath = await this.resolveUploadFilePath(info);
    } catch (error) {
      once(error);
      return;
    }

    ChatClient.getInstance()
      .groupManager.uploadGroupSharedFile(
        groupId,
        filePath,
        new (class implements ChatGroupFileStatusCallback {
          onProgress(
            callbackGroupId: string,
            callbackFilePath: string,
            progress: number,
          ): void {
            console.log(
              this.onProgress.name,
              callbackGroupId,
              callbackFilePath,
              progress,
            );
          }
          onError(
            callbackGroupId: string,
            callbackFilePath: string,
            error: ChatError,
          ): void {
            console.log(
              this.onError.name,
              callbackGroupId,
              callbackFilePath,
              error,
            );
            once(error);
          }
          onSuccess(callbackGroupId: string, callbackFilePath: string): void {
            console.log(this.onSuccess.name, callbackGroupId, callbackFilePath);
            once(null);
          }
        })(),
      )
      .catch(error => {
        once(error);
      });
  }
```

- [ ] **Step 5: Replace downloadGroupSharedFile placeholder**

Replace the current `downloadGroupSharedFile` method with:

```typescript
  static async downloadGroupSharedFile(info: any, callback: ReturnCallback) {
    const once = this.createOneShotCallback(callback);
    const groupId = info.groupId;
    const fileId = info.fileId;
    let savePath;
    try {
      savePath = await this.resolveDownloadSavePath(info);
    } catch (error) {
      once(error);
      return;
    }

    ChatClient.getInstance()
      .groupManager.downloadGroupSharedFile(
        groupId,
        fileId,
        savePath,
        new (class implements ChatGroupFileStatusCallback {
          onProgress(
            callbackGroupId: string,
            callbackFilePath: string,
            progress: number,
          ): void {
            console.log(
              this.onProgress.name,
              callbackGroupId,
              callbackFilePath,
              progress,
            );
          }
          onError(
            callbackGroupId: string,
            callbackFilePath: string,
            error: ChatError,
          ): void {
            console.log(
              this.onError.name,
              callbackGroupId,
              callbackFilePath,
              error,
            );
            once(error);
          }
          onSuccess(callbackGroupId: string, callbackFilePath: string): void {
            console.log(this.onSuccess.name, callbackGroupId, callbackFilePath);
            once(null);
          }
        })(),
      )
      .catch(error => {
        once(error);
      });
  }
```

- [ ] **Step 6: Run group shared file tests**

Run:

```bash
cd measured_app
yarn test __tests__/BizChatGroupManager.file-helper.test.ts
```

Expected: PASS.

## Task 7: Add Fixture Files to Android and iOS Bundles

**Files:**
- Create: `measured_app/android/app/src/main/assets/upload-fixtures/test-image.jpg`
- Create: `measured_app/android/app/src/main/assets/upload-fixtures/test-audio.m4a`
- Create: `measured_app/android/app/src/main/assets/upload-fixtures/test-video.mp4`
- Create: `measured_app/android/app/src/main/assets/upload-fixtures/test-file.txt`
- Create: `measured_app/android/app/src/main/assets/upload-fixtures/test-large-8mb.bin`
- Create: `measured_app/ios/rn_wayang/upload-fixtures/test-image.jpg`
- Create: `measured_app/ios/rn_wayang/upload-fixtures/test-audio.m4a`
- Create: `measured_app/ios/rn_wayang/upload-fixtures/test-video.mp4`
- Create: `measured_app/ios/rn_wayang/upload-fixtures/test-file.txt`
- Create: `measured_app/ios/rn_wayang/upload-fixtures/test-large-8mb.bin`
- Modify: `measured_app/ios/rn_wayang.xcodeproj/project.pbxproj`

- [ ] **Step 1: Create fixture directories**

Run:

```bash
mkdir -p measured_app/android/app/src/main/assets/upload-fixtures
mkdir -p measured_app/ios/rn_wayang/upload-fixtures
```

Expected: both fixture directories exist.

- [ ] **Step 2: Generate fixtures in a temporary directory**

Run from the repository root:

```bash
mkdir -p /tmp/wayang-upload-fixtures
ffmpeg -y \
  -f lavfi -i testsrc=size=640x360:rate=1 \
  -frames:v 1 \
  /tmp/wayang-upload-fixtures/test-image.jpg
ffmpeg -y \
  -f lavfi -i sine=frequency=1000:duration=3 \
  -c:a aac -b:a 96k \
  /tmp/wayang-upload-fixtures/test-audio.m4a
ffmpeg -y \
  -f lavfi -i testsrc=size=640x360:rate=24:duration=3 \
  -f lavfi -i sine=frequency=440:duration=3 \
  -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.0 \
  -c:a aac -b:a 96k \
  -shortest \
  /tmp/wayang-upload-fixtures/test-video.mp4
printf 'wayang upload fixture\n' > /tmp/wayang-upload-fixtures/test-file.txt
dd if=/dev/urandom of=/tmp/wayang-upload-fixtures/test-large-8mb.bin bs=1m count=8
```

Expected: `ffmpeg` succeeds for image/audio/video; `dd` reports `8388608 bytes transferred`.

If `ffmpeg` is not installed, create equivalent small image, audio, and video fixtures by another local tool, keeping the exact filenames and approximate metadata from the spec:

```text
test-image.jpg: JPEG image, 640 x 360, under 2 MB
test-audio.m4a: AAC audio, about 3 seconds, under 2 MB
test-video.mp4: H.264/AAC video, 640 x 360, about 3 seconds, under 2 MB
```

- [ ] **Step 3: Copy fixtures into Android and iOS bundle directories**

Run:

```bash
cp /tmp/wayang-upload-fixtures/test-image.jpg measured_app/android/app/src/main/assets/upload-fixtures/test-image.jpg
cp /tmp/wayang-upload-fixtures/test-audio.m4a measured_app/android/app/src/main/assets/upload-fixtures/test-audio.m4a
cp /tmp/wayang-upload-fixtures/test-video.mp4 measured_app/android/app/src/main/assets/upload-fixtures/test-video.mp4
cp /tmp/wayang-upload-fixtures/test-file.txt measured_app/android/app/src/main/assets/upload-fixtures/test-file.txt
cp /tmp/wayang-upload-fixtures/test-large-8mb.bin measured_app/android/app/src/main/assets/upload-fixtures/test-large-8mb.bin
cp /tmp/wayang-upload-fixtures/test-image.jpg measured_app/ios/rn_wayang/upload-fixtures/test-image.jpg
cp /tmp/wayang-upload-fixtures/test-audio.m4a measured_app/ios/rn_wayang/upload-fixtures/test-audio.m4a
cp /tmp/wayang-upload-fixtures/test-video.mp4 measured_app/ios/rn_wayang/upload-fixtures/test-video.mp4
cp /tmp/wayang-upload-fixtures/test-file.txt measured_app/ios/rn_wayang/upload-fixtures/test-file.txt
cp /tmp/wayang-upload-fixtures/test-large-8mb.bin measured_app/ios/rn_wayang/upload-fixtures/test-large-8mb.bin
```

Expected: all ten fixture files exist.

- [ ] **Step 4: Verify fixture sizes**

Run:

```bash
find measured_app/android/app/src/main/assets/upload-fixtures measured_app/ios/rn_wayang/upload-fixtures -maxdepth 1 -type f -print0 | xargs -0 ls -lh
```

Expected:

```text
test-image.jpg, test-audio.m4a, test-video.mp4, and test-file.txt are each below 2 MB.
test-large-8mb.bin is about 8.0 MB in both Android and iOS directories.
```

- [ ] **Step 5: Add iOS folder reference to Copy Bundle Resources**

Modify `measured_app/ios/rn_wayang.xcodeproj/project.pbxproj` so the `upload-fixtures` directory is preserved at runtime as `${RNFS.MainBundlePath}/upload-fixtures/<filename>`.

Add these two objects with fresh unique 24-character uppercase hex IDs in the appropriate sections:

```text
/* Begin PBXBuildFile section */
		<NEW_BUILD_FILE_ID> /* upload-fixtures in Resources */ = {isa = PBXBuildFile; fileRef = <NEW_FILE_REF_ID> /* upload-fixtures */; };
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		<NEW_FILE_REF_ID> /* upload-fixtures */ = {isa = PBXFileReference; lastKnownFileType = folder; name = "upload-fixtures"; path = "rn_wayang/upload-fixtures"; sourceTree = "<group>"; };
/* End PBXFileReference section */
```

Add the file reference to the `rn_wayang` PBXGroup children:

```text
				<NEW_FILE_REF_ID> /* upload-fixtures */,
```

Add the build file to the `Resources` PBXResourcesBuildPhase files list:

```text
				<NEW_BUILD_FILE_ID> /* upload-fixtures in Resources */,
```

Use `lastKnownFileType = folder`, not separate file references, so Xcode copies the directory as a folder and does not flatten the files into the bundle root.

- [ ] **Step 6: Verify iOS project references**

Run:

```bash
rg -n "upload-fixtures|lastKnownFileType = folder" measured_app/ios/rn_wayang.xcodeproj/project.pbxproj
```

Expected: output includes one `PBXFileReference` named `upload-fixtures`, one `PBXBuildFile` named `upload-fixtures in Resources`, one PBXGroup child entry, and one Resources build phase entry.

## Task 8: Verify Dependencies, Dispatch, and Full Test Suite

**Files:**
- Verify: `measured_app/package.json`
- Verify: `measured_app/yarn.lock`
- Verify generated dispatch files under: `measured_app/src/dispatch/*.generated.ts`

- [ ] **Step 1: Confirm `react-native-fs` dependency is present**

Run:

```bash
cd measured_app
node -e "const p=require('./package.json'); if (!p.dependencies || !p.dependencies['react-native-fs']) { process.exit(1); } console.log(p.dependencies['react-native-fs']);"
```

Expected: prints the installed `react-native-fs` version range, for example `^2.20.0`.

If this command exits `1`, add the dependency from `measured_app`:

```bash
cd measured_app
yarn add react-native-fs
```

Expected: `package.json` and `yarn.lock` update. Review those diffs because these files may already contain user changes.

- [ ] **Step 2: Regenerate dispatch routes**

Run:

```bash
cd measured_app
yarn generate:dispatch
```

Expected: command exits `0`. Generated dispatch route files should not change for this feature because no new public wrapper command names are being added.

- [ ] **Step 3: Review generated dispatch diff**

Run:

```bash
git diff -- measured_app/src/dispatch
```

Expected: no generated dispatch diff caused by this feature. If there is a diff, inspect it before continuing; do not commit unreviewed generated route changes.

- [ ] **Step 4: Run API alignment audit**

Run:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

Expected: command exits `0`. Existing known audit notes may remain, but this change must not add new missing generated route coverage or expose `FileHelper` as a route.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd measured_app
yarn test __tests__/FileHelper.test.ts
yarn test __tests__/BizChatManager.file-helper.test.ts
yarn test __tests__/BizChatGroupManager.file-helper.test.ts
yarn test __tests__/BizChatManager.response.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 6: Run full lint and Jest suite**

Run:

```bash
cd measured_app
yarn lint
yarn test
```

Expected: both commands PASS.

## Task 9: Manual Runtime Smoke Checklist

**Files:**
- No additional planned file edits.

- [ ] **Step 1: Android fixture materialization smoke**

Run the app on Android and send:

```json
{
  "cmd": "ChatManager.sendMessage",
  "info": {
    "type": "image",
    "username": "target-user",
    "fixtureName": "test-image.jpg"
  }
}
```

Expected: the app copies `upload-fixtures/test-image.jpg` from APK assets to `RNFS.DocumentDirectoryPath/upload-fixtures/test-image.jpg`, sends exactly one WebSocket response, and no progress event sends a response.

- [ ] **Step 2: iOS fixture materialization smoke**

Run the app on iOS and send the same image payload.

Expected: the app copies `${RNFS.MainBundlePath}/upload-fixtures/test-image.jpg` to `RNFS.DocumentDirectoryPath/upload-fixtures/test-image.jpg`, sends exactly one WebSocket response, and the iOS resource path is not flattened.

- [ ] **Step 3: Attachment message smoke**

Send one payload for each attachment type:

```json
{"cmd":"ChatManager.sendMessage","info":{"type":"image","username":"target-user","fixtureName":"test-image.jpg"}}
{"cmd":"ChatManager.sendMessage","info":{"type":"voice","username":"target-user","fixtureName":"test-audio.m4a"}}
{"cmd":"ChatManager.sendMessage","info":{"type":"video","username":"target-user","fixtureName":"test-video.mp4"}}
{"cmd":"ChatManager.sendMessage","info":{"type":"file","username":"target-user","fixtureName":"test-file.txt","displayName":"test-file.txt"}}
{"cmd":"ChatManager.sendMessage","info":{"type":"file","username":"target-user","fixtureName":"test-large-8mb.bin","displayName":"test-large-8mb.bin"}}
```

Expected: each request receives exactly one WebSocket response from SDK send success or SDK send error.

- [ ] **Step 4: Group shared file smoke**

Upload:

```json
{
  "cmd": "ChatGroupManager.uploadGroupSharedFile",
  "info": {
    "groupId": "group-id",
    "fixtureName": "test-large-8mb.bin"
  }
}
```

Fetch group files and then download with a returned `fileId`:

```json
{
  "cmd": "ChatGroupManager.downloadGroupSharedFile",
  "info": {
    "groupId": "group-id",
    "fileId": "shared-file-id",
    "saveFilename": "downloaded-test-large-8mb.bin"
  }
}
```

Expected: upload and download each produce exactly one WebSocket response, and progress events only log.

## Task 10: Final Review and Single Commit

**Files:**
- Review all files changed by Tasks 1-9.

- [ ] **Step 1: Review working tree**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files match this plan. Existing pre-plan user changes may also appear; do not revert them.

- [ ] **Step 2: Inspect high-risk diffs**

Run:

```bash
git diff -- measured_app/src/FileHelper.ts measured_app/src/biz/BizChatManager.ts measured_app/src/biz/BizChatGroupManager.ts measured_app/ios/rn_wayang.xcodeproj/project.pbxproj
```

Expected:

```text
FileHelper validates names, copies Android/iOS fixtures to DocumentDirectoryPath, and creates writable download paths.
BizChatManager path fields take precedence over fixture fields, file messages are supported, and send callbacks are one-shot.
BizChatGroupManager shared-file placeholders are gone, path fields take precedence, fixture/save-name helpers are used, and callbacks are one-shot.
The iOS project copies upload-fixtures as a folder resource, preserving the runtime directory.
```

- [ ] **Step 3: Inspect binary/resource additions**

Run:

```bash
find measured_app/android/app/src/main/assets/upload-fixtures measured_app/ios/rn_wayang/upload-fixtures -maxdepth 1 -type f -print | sort
```

Expected: exactly these files in both directories:

```text
test-audio.m4a
test-file.txt
test-image.jpg
test-large-8mb.bin
test-video.mp4
```

- [ ] **Step 4: Run final verification**

Run:

```bash
cd measured_app
yarn generate:dispatch
yarn audit:chat-sdk-api
yarn lint
yarn test
```

Expected: all commands exit `0`.

- [ ] **Step 5: Make one final commit**

Stage only the files that belong to this design plus any existing dependency metadata changes that are required for `react-native-fs`:

```bash
git add docs/superpowers/specs/2026-06-17-file-helper-fixture-paths-design.md
git add docs/superpowers/plans/2026-06-17-file-helper-fixture-paths.md
git add measured_app/src/FileHelper.ts
git add measured_app/src/biz/BizChatManager.ts
git add measured_app/src/biz/BizChatGroupManager.ts
git add measured_app/__tests__/FileHelper.test.ts
git add measured_app/__tests__/BizChatManager.file-helper.test.ts
git add measured_app/__tests__/BizChatGroupManager.file-helper.test.ts
git add measured_app/android/app/src/main/assets/upload-fixtures
git add measured_app/ios/rn_wayang/upload-fixtures
git add measured_app/ios/rn_wayang.xcodeproj/project.pbxproj
git add measured_app/package.json measured_app/yarn.lock
git commit -m "feat: add fixture-backed file helper paths"
```

Expected: one commit contains the complete spec, plan, implementation, tests, fixture resources, iOS project resource reference, and required dependency metadata. If `package.json` or `yarn.lock` contain unrelated user edits, review and stage only the hunks required for `react-native-fs`.

## Self-Review

- Spec coverage:
  - Fixed fixture files are covered in Task 7.
  - Android asset placement is covered in Task 7.
  - iOS bundle placement with preserved `upload-fixtures` directory is covered in Task 7.
  - `FileHelper` API, whitelist validation, safe writable filenames, fixture copying, unsupported platforms, and metadata are covered in Tasks 1-2.
  - `ChatManager.sendMessage` fixture-backed image/video/voice/file support and one-shot responses are covered in Tasks 3-4.
  - `ChatGroupManager.uploadGroupSharedFile` and `downloadGroupSharedFile` fixture/save-name support and one-shot responses are covered in Tasks 5-6.
  - Validation commands are covered in Task 8 and Task 10.
  - Runtime smoke tests are covered in Task 9.
- Placeholder scan:
  - No unfinished placeholder markers or unspecified test-writing steps remain.
  - The only conditional path is fixture generation if `ffmpeg` is unavailable, and it gives exact filename/metadata requirements.
- Type consistency:
  - `FixtureName`, `FixtureMetadata`, `FixturePath`, and `WritablePath` match the spec.
  - `fixtureName` and `saveFilename` wrapper fields are used consistently.
  - SDK callback signatures match local `react-native-chat-sdk` declarations for `ChatMessageStatusCallback` and `ChatGroupFileStatusCallback`.
