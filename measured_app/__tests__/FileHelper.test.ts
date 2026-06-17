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
    expect(() =>
      FileHelper.assertSafeFilename('downloaded-test-file.txt'),
    ).not.toThrow();
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
    mockedRNFS.exists.mockResolvedValue(true);

    const result = await FileHelper.materializeFixture('test-audio.m4a');

    expect(mockedRNFS.mkdir).toHaveBeenCalledWith('/documents/upload-fixtures');
    expect(mockedRNFS.unlink).toHaveBeenCalledWith(
      '/documents/upload-fixtures/test-audio.m4a',
    );
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
    expect(mockedRNFS.mkdir).not.toHaveBeenCalled();
    expect(mockedRNFS.exists).not.toHaveBeenCalled();
    expect(mockedRNFS.unlink).not.toHaveBeenCalled();
    expect(mockedRNFS.copyFile).not.toHaveBeenCalled();
    expect(mockedRNFS.copyFileAssets).not.toHaveBeenCalled();
  });

  test('createWritablePath removes an existing target and returns savePath without creating a file', async () => {
    mockedRNFS.exists.mockResolvedValue(true);

    const result = await FileHelper.createWritablePath(
      'downloaded-test-file.txt',
    );

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

  test('createWritablePath rejects unsafe names before filesystem access', async () => {
    await expect(
      FileHelper.createWritablePath('../escape.txt'),
    ).rejects.toThrow(/unsafe filename/i);

    expect(mockedRNFS.mkdir).not.toHaveBeenCalled();
    expect(mockedRNFS.exists).not.toHaveBeenCalled();
    expect(mockedRNFS.unlink).not.toHaveBeenCalled();
    expect(mockedRNFS.copyFile).not.toHaveBeenCalled();
    expect(mockedRNFS.copyFileAssets).not.toHaveBeenCalled();
  });
});
