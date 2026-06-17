# File Helper Fixture Paths Design

## Context

`measured_app` is a remote-controlled React Native puppet for exercising
`react-native-chat-sdk` APIs through WebSocket commands. Some SDK operations
require native-readable local filesystem paths:

- sending attachment messages through `ChatManager.sendMessage`;
- uploading group shared files through
  `ChatGroupManager.uploadGroupSharedFile`;
- downloading group shared files through
  `ChatGroupManager.downloadGroupSharedFile`.

The test driver, usually JMeter, cannot reliably provide these paths. The
measured app may run on an Android emulator, an Android device, an iOS
simulator, or an iOS device. Each environment has different sandbox paths, and
Android APK assets are not normal filesystem paths.

The measured app should carry fixed fixture files and use a small filesystem
helper inside selected SDK wrappers so the driver can refer to fixture files by
stable names instead of native sandbox paths.

This design targets the measured app's supported native runtimes only:
Android and iOS. Other React Native platforms are out of scope and should fail
with an explicit unsupported-platform error if reached.

## Goal

Add a `FileHelper` utility that gives selected wrappers stable access to
bundled fixture files and writable download targets across Android and iOS.

The helper should support three test categories:

1. Send attachment messages by resolving a fixture path and passing it as
   `localPath` to `ChatManager.sendMessage`.
2. Upload group shared files by resolving a fixture path and passing it as
   `filePath` to `ChatGroupManager.uploadGroupSharedFile`.
3. Download group shared files by creating a writable save path and passing it
   as `savePath` to `ChatGroupManager.downloadGroupSharedFile`.

## Non-Goals

- Do not change `react-native-chat-sdk` public APIs.
- Do not make SDK wrappers choose default fixture files when the caller omits
  `localPath`, `filePath`, or `savePath`.
- Do not make the test driver upload files from the host machine into the app.
- Do not treat React Native asset references, APK asset paths, or `file://`
  URIs as SDK-ready local paths.
- Do not expose `FileHelper` as an independent WebSocket command in this
  design.
- Do not treat progress callbacks as multiple WebSocket responses.
- Do not run broad wrapper quality convergence as part of this design.
- Do not add support for non-Android and non-iOS runtimes.

## Fixture Files

The app should contain these fixed fixture files:

- `test-image.jpg`;
- `test-audio.m4a`;
- `test-video.mp4`;
- `test-file.txt`;
- `test-large-8mb.bin`.

Small image, audio, video, and text fixtures should stay below 2 MB each. The
large binary fixture targets about 8 MiB so tests can exercise large-file or
chunked-upload behavior even though chunking is not visible in the JavaScript
API. If runtime testing shows that 8 MiB does not cross the SDK or service
chunking threshold, a later task may increase it to 9 MiB or to
`8 MiB + 1 byte`.

Fixtures may be prepared manually. A reproducible generation path is still
preferred for reviewability:

```bash
ffmpeg -y \
  -f lavfi -i testsrc=size=640x360:rate=1 \
  -frames:v 1 \
  test-image.jpg

ffmpeg -y \
  -f lavfi -i sine=frequency=1000:duration=3 \
  -c:a aac -b:a 96k \
  test-audio.m4a

ffmpeg -y \
  -f lavfi -i testsrc=size=640x360:rate=24:duration=3 \
  -f lavfi -i sine=frequency=440:duration=3 \
  -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.0 \
  -c:a aac -b:a 96k \
  -shortest \
  test-video.mp4

printf 'wayang upload fixture\n' > test-file.txt

dd if=/dev/urandom of=test-large-8mb.bin bs=1m count=8
```

`ffmpeg` is only a fixture preparation tool. It is not a runtime or build-time
dependency of `measured_app`.

## Bundle Placement

Android fixtures live under:

```text
measured_app/android/app/src/main/assets/upload-fixtures/
```

iOS fixtures live in the app bundle under:

```text
upload-fixtures/
```

iOS must include the files in the measured app target's Copy Bundle Resources.
Use an Xcode folder reference or an equivalent project setup that preserves the
runtime directory:

```text
${RNFS.MainBundlePath}/upload-fixtures/<filename>
```

If iOS files are added as a normal Xcode group and flattened into the bundle
root, the implementation must either adjust the source path or change the Xcode
resource setup so the `upload-fixtures` directory is preserved.

## FileHelper

Add a narrow utility class:

```text
measured_app/src/FileHelper.ts
```

The helper should use `react-native-fs` and hide platform-specific file
materialization from the wrappers that need filesystem paths.

### API Contract

```typescript
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

export class FileHelper {
  static readonly fixtureDirName = 'upload-fixtures';
  static readonly downloadDirName = 'group-shared-downloads';
  static readonly fixtureNames: readonly FixtureName[];

  static materializeFixture(filename: string): Promise<FixturePath>;

  static createWritablePath(filename: string): Promise<WritablePath>;

  static isFixtureName(filename: string): filename is FixtureName;

  static assertSafeFilename(filename: string): void;
}
```

`FileHelper` is an internal utility, not a WebSocket command surface. Tests use
it indirectly by passing wrapper-specific fields such as `fixtureName` and
`saveFilename` to the SDK command they are already testing.

The validation helpers are implementation support APIs so wrappers and future
filesystem helpers can share the same path safety rules.

`FileHelper` methods should reject their Promise with an `Error` when input
validation fails or when filesystem operations fail. SDK wrappers should pass
that error to the normal API callback path; they should not convert these
failures into protocol errors.

Generated dispatch routes call wrapper methods synchronously and do not await
their return values. Wrappers that use `FileHelper` may therefore be declared
`async`, but they must catch their own errors and invoke the supplied
`ReturnCallback`. An unhandled rejected Promise would leave the WebSocket
request without a response.

### `materializeFixture`

Behavior:

1. Validate `filename` against the known fixture whitelist.
2. Create `RNFS.DocumentDirectoryPath/upload-fixtures`.
3. Remove an existing destination file with the same name.
4. On Android, copy from the APK asset with
   `RNFS.copyFileAssets('upload-fixtures/<filename>', destPath)`.
5. On iOS, copy from
   `${RNFS.MainBundlePath}/upload-fixtures/<filename>` to `destPath`.
6. On other platforms, reject with an `Error` that clearly identifies the
   unsupported platform.
7. Return the native-readable destination path.

The SDK should receive this copied path, not the original bundle or APK asset
location.

`localPath` and `filePath` intentionally contain the same absolute path. This
keeps JMeter payloads simple for both message attachments and group shared
file uploads.

### `createWritablePath`

Behavior:

1. Validate that `filename` is a plain file name, not a path.
2. Create `RNFS.DocumentDirectoryPath/group-shared-downloads`.
3. Remove an existing target file with the same name.
4. Return the target path without creating the file.

This path is intended for `ChatGroupManager.downloadGroupSharedFile`.

## Filename Safety

`materializeFixture` should allow only the committed fixture names:

```text
test-image.jpg
test-audio.m4a
test-video.mp4
test-file.txt
test-large-8mb.bin
```

`createWritablePath` may accept caller-selected file names, but it must reject:

- empty values;
- path separators;
- `.` and `..`;
- absolute paths;
- names containing platform path traversal.

The helper removes existing destination files before copying or returning a
save path, so filename validation is part of the core design rather than a
nice-to-have.

## Fixture Metadata

Some attachment message factories need metadata beyond the local file path.

The helper may return fixed metadata for known fixtures:

```typescript
type FixtureMetadata = {
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailLocalPath?: string;
};
```

Baseline fixture metadata:

- `test-image.jpg`: image fixture, 640 x 360.
- `test-audio.m4a`: voice/audio fixture, 3 seconds.
- `test-video.mp4`: video fixture, 640 x 360, 3 seconds.
- `test-file.txt`: generic file fixture.
- `test-large-8mb.bin`: generic large file fixture.

For video messages, tests may use `test-image.jpg` as a stable thumbnail by
calling `materializeFixture('test-image.jpg')` and passing the returned
`localPath` as `thumbnailLocalPath`.

## Wrapper Input Extensions

`FileHelper` is used by concrete API wrappers only when the driver supplies the
fixture-oriented extension fields below.

Path fields always take precedence over fixture fields:

- if `localPath` is present, `ChatManager.sendMessage` uses it directly;
- if `filePath` is present, `ChatGroupManager.uploadGroupSharedFile` uses it
  directly;
- if `savePath` is present, `ChatGroupManager.downloadGroupSharedFile` uses it
  directly.

When a path field is absent, the wrapper may resolve a fixture or save filename:

- `fixtureName` resolves through `FileHelper.materializeFixture`;
- `saveFilename` resolves through `FileHelper.createWritablePath`.

This keeps the normal SDK path contract available while giving JMeter a stable
fixture-name contract for mobile runtime tests.

## Wrapper Behavior

The three attachment/file-transfer wrappers in this design share the same
response rule: they may perform asynchronous fixture or writable-path
preparation before calling the SDK, but they must produce exactly one
WebSocket response through the supplied callback.

Use a one-shot callback guard for these wrappers. Startup Promise rejection,
transfer failure, and transfer success are separate asynchronous paths and must
not be allowed to respond more than once. Progress callbacks must log only and
must not call the WebSocket callback.

### `ChatManager.sendMessage`

`sendMessage` should keep the existing wrapper model: the driver supplies a
small message description, and the wrapper creates a `ChatMessage` with SDK
factory methods.

The wrapper should support attachment message types needed by the fixtures:

- `image` through `ChatMessage.createImageMessage`;
- `video` through `ChatMessage.createVideoMessage`;
- `voice` through `ChatMessage.createVoiceMessage`;
- `file` through `ChatMessage.createFileMessage`.

The current wrapper already supports `image`, `video`, and `voice`. This design
requires adding `file` support so `test-file.txt` and `test-large-8mb.bin` can
be sent as ordinary file attachment messages.

The wrapper should read caller-supplied `localPath`. It must not choose a
default fixture when `localPath` is absent.

If `localPath` is absent and `fixtureName` is present, the wrapper should call
`FileHelper.materializeFixture(fixtureName)` and use the returned `localPath`.
This naturally makes the send path asynchronous; `sendMessage` and any helper
that resolves fixture-backed messages may be implemented as `async` methods as
long as all thrown errors and rejected Promises are caught and passed to the
normal callback path.

Message send completion should return exactly one WebSocket response:

- success from `ChatMessageStatusCallback.onSuccess`;
- SDK send error from `ChatMessageStatusCallback.onError`;
- SDK startup failure from the returned Promise rejection.

`onProgress` must log only and must not call the WebSocket callback. Use the
same one-shot callback guard described above so `onSuccess`, `onError`, and
startup failure cannot produce duplicate responses.

### `ChatGroupManager.uploadGroupSharedFile`

The wrapper should:

1. Read `groupId` and `filePath` from `info`.
2. If `filePath` is absent and `fixtureName` is present, call
   `FileHelper.materializeFixture(fixtureName)` and use the returned
   `filePath`.
3. Call
   `ChatClient.getInstance().groupManager.uploadGroupSharedFile(groupId,
   filePath, callback)`.
4. Log progress events.
5. Return exactly one WebSocket response:
   - success from `ChatGroupFileStatusCallback.onSuccess`;
   - SDK transfer error from `ChatGroupFileStatusCallback.onError`;
   - SDK startup failure from the returned Promise rejection.

The wrapper should use a one-shot callback guard so startup failure, transfer
failure, and transfer success cannot respond more than once.

This wrapper may be implemented as `async` so fixture materialization can be
awaited before the SDK upload call. It must catch fixture preparation errors
and SDK startup errors and pass them to the one-shot callback guard.

### `ChatGroupManager.downloadGroupSharedFile`

The wrapper should:

1. Read `groupId`, `fileId`, and `savePath` from `info`.
2. If `savePath` is absent and `saveFilename` is present, call
   `FileHelper.createWritablePath(saveFilename)` and use the returned
   `savePath`.
3. Call
   `ChatClient.getInstance().groupManager.downloadGroupSharedFile(groupId,
   fileId, savePath, callback)`.
4. Log progress events.
5. Return exactly one WebSocket response with the same one-shot callback rule as
   upload.

This wrapper may be implemented as `async` so writable-path preparation can be
awaited before the SDK download call. It must catch writable-path preparation
errors and SDK startup errors and pass them to the one-shot callback guard.

## JMeter Flows

### Send Attachment Message

1. Call `ChatManager.sendMessage` with `type`, target fields, and
   `fixtureName`.
2. For video messages, either pass `thumbnailLocalPath` explicitly or let the
   implementation use fixture metadata where supported.

Example image send payload:

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

Example file send payload:

```json
{
  "cmd": "ChatManager.sendMessage",
  "info": {
    "type": "file",
    "username": "target-user",
    "fixtureName": "test-file.txt",
    "displayName": "test-file.txt"
  }
}
```

### Upload Group Shared File

1. Call `ChatGroupManager.uploadGroupSharedFile` with `groupId` and
   `fixtureName`.

Example payload:

```json
{
  "cmd": "ChatGroupManager.uploadGroupSharedFile",
  "info": {
    "groupId": "group-id",
    "fixtureName": "test-large-8mb.bin"
  }
}
```

### Download Group Shared File

1. Obtain a valid `fileId`, typically by calling
   `ChatGroupManager.fetchGroupFileListFromServer` after upload.
2. Call `ChatGroupManager.downloadGroupSharedFile` with `groupId`, `fileId`,
   and `saveFilename`.

Example payload:

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

## Validation

Run from `measured_app`:

```bash
yarn generate:dispatch
yarn audit:chat-sdk-api
yarn lint
yarn test
```

Generated dispatch diffs should be reviewed before committing. Internal helper
utilities should not be exposed as generated SDK routes.

Runtime smoke tests should cover:

- Android fixture materialization from APK assets;
- iOS fixture materialization from the app bundle;
- sending image, voice/audio, video, file, and large file messages;
- uploading a group shared file with a materialized fixture path;
- downloading a group shared file to a generated writable path.

## Self-Review

- Placeholder scan: no `TBD` or open placeholder remains.
- Scope check: the design centers on FileHelper path materialization and the
  three file-transfer test categories.
- Naming check: old group-only helper routes were replaced with wrapper input
  fields `fixtureName` and `saveFilename`.
