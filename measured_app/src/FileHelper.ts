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

    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      throw new Error(`unsupported platform: ${Platform.OS}`);
    }

    const fixtureDir = `${RNFS.DocumentDirectoryPath}/${this.fixtureDirName}`;
    const destPath = `${fixtureDir}/${filename}`;

    await RNFS.mkdir(fixtureDir);
    await this.removeIfExists(destPath);

    if (Platform.OS === 'android') {
      await RNFS.copyFileAssets(`${this.fixtureDirName}/${filename}`, destPath);
    } else {
      await RNFS.copyFile(
        `${RNFS.MainBundlePath}/${this.fixtureDirName}/${filename}`,
        destPath,
      );
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
