# Group Shared File Fixtures Design

## Context

`measured_app/src/biz/BizChatGroupManager.ts` currently does not execute real
group shared-file transfers:

- `ChatGroupManager.uploadGroupSharedFile` immediately calls `callback(null)`;
- `ChatGroupManager.downloadGroupSharedFile` immediately calls `callback(null)`;
- the SDK calls are commented out.

The SDK methods require native-readable local filesystem paths:

```typescript
uploadGroupSharedFile(
  groupId: string,
  filePath: string,
  callback?: ChatGroupFileStatusCallback,
): Promise<void>

downloadGroupSharedFile(
  groupId: string,
  fileId: string,
  savePath: string,
  callback?: ChatGroupFileStatusCallback,
): Promise<void>
```

The SDK Promise reports startup failure or success. Transfer progress and final
transfer success/failure are delivered through `ChatGroupFileStatusCallback`.

## Goal

Restore real SDK upload/download calls and provide stable fixture-file helpers
so JMeter can pass valid local paths to the SDK on both Android and iOS.

## Non-Goals

- Do not change `react-native-chat-sdk` public APIs.
- Do not make `uploadGroupSharedFile` choose a default fixture when `filePath`
  is absent.
- Do not make `downloadGroupSharedFile` choose a default save path when
  `savePath` is absent.
- Do not modify `BizChatManager` message wrapper semantics in this design.
- Do not run broad wrapper quality convergence.
- Do not treat progress events as multiple WebSocket responses.

## Fixture Files

The app should contain fixed upload fixture files:

- `test-image.jpg`;
- `test-audio.m4a`;
- `test-video.mp4`;
- `test-file.txt`;
- `test-large-8mb.bin`.

Small image, audio, video, and text fixtures should stay below 2 MB each. The
large binary fixture targets about 8 MiB so testers can exercise large-file or
chunked-upload behavior. If runtime testing shows that 8 MiB does not cross the
SDK/server chunking threshold, a later task may increase it to 9 MiB or to
`8 MiB + 1 byte`.

Fixtures may be prepared manually, but the recommended reproducible approach is
to generate media fixtures with FFmpeg and text/binary fixtures with shell
commands. Generated files are committed as fixed app resources.

Example generation commands:

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
Using an Xcode folder reference is preferred so the runtime source path remains:

```text
${RNFS.MainBundlePath}/upload-fixtures/<filename>
```

If iOS files are added as a normal Xcode group and flattened into the bundle
root, implementation must either adjust the source path or change the Xcode
resource setup so the `upload-fixtures` directory is preserved.

## Runtime Path Strategy

Use `react-native-fs` to copy fixtures from the platform bundle into
`RNFS.DocumentDirectoryPath` before upload.

Do not pass any of these values to the SDK:

- `assets://...`;
- `res://...`;
- `content://...`;
- `file://...`;
- React Native `require(...)` asset results;
- Android APK asset paths.

The path passed to the SDK must be a normal local path such as:

```text
/data/user/0/<package>/files/upload-fixtures/test-image.jpg
```

or:

```text
/var/mobile/Containers/Data/Application/.../Documents/upload-fixtures/test-image.jpg
```

## Dependency

Add `react-native-fs` to `measured_app`.

iOS requires CocoaPods installation after the dependency is added. Android
should use React Native autolinking unless implementation discovers project
configuration requiring manual linking.

## Internal Helper Routes

Add internal helper routes for test setup. These helpers are part of the puppet
test protocol, not the SDK API surface.

### `Internal.prepareUploadFixture`

Input:

```json
{
  "filename": "test-image.jpg"
}
```

Behavior:

1. Create `RNFS.DocumentDirectoryPath/upload-fixtures`.
2. Remove an existing destination file with the same name.
3. On Android, copy from `android/app/src/main/assets/upload-fixtures/<filename>`
   with `RNFS.copyFileAssets('upload-fixtures/<filename>', destPath)`.
4. On iOS, copy from
   `${RNFS.MainBundlePath}/upload-fixtures/<filename>` to `destPath`.
5. Return the copied path.

Response value:

```json
{
  "filePath": "/absolute/local/path"
}
```

### `Internal.prepareGroupSharedDownloadPath`

Input:

```json
{
  "filename": "downloaded-test-image.jpg"
}
```

Behavior:

1. Create `RNFS.DocumentDirectoryPath/group-shared-downloads`.
2. Remove an existing target file with the same name.
3. Return the target save path without creating the file.

Response value:

```json
{
  "savePath": "/absolute/local/path"
}
```

## Wrapper Behavior

### `uploadGroupSharedFile`

The wrapper should:

1. Read `groupId` and `filePath` from `info`.
2. Call
   `ChatClient.getInstance().groupManager.uploadGroupSharedFile(groupId,
   filePath, callback)`.
3. Log progress events.
4. Return exactly one WebSocket response:
   - success from `onSuccess`;
   - SDK transfer error from `onError`;
   - SDK startup failure from the returned Promise rejection.

The wrapper should use a one-shot callback guard so a startup failure and a
later status callback cannot both respond to the same request.

`onProgress` must not call the WebSocket callback because the protocol expects
one response per request.

### `downloadGroupSharedFile`

The wrapper should:

1. Read `groupId`, `fileId`, and `savePath` from `info`.
2. Call
   `ChatClient.getInstance().groupManager.downloadGroupSharedFile(groupId,
   fileId, savePath, callback)`.
3. Log progress events.
4. Return exactly one WebSocket response with the same one-shot callback rule as
   upload.

## JMeter Flow

A JMeter flow for upload should:

1. Call `Internal.prepareUploadFixture` with the desired fixture filename.
2. Save the returned `filePath`.
3. Call `ChatGroupManager.uploadGroupSharedFile` with `groupId` and `filePath`.

A JMeter flow for download should:

1. Obtain a valid `fileId`, typically by calling
   `ChatGroupManager.fetchGroupFileListFromServer` after upload.
2. Call `Internal.prepareGroupSharedDownloadPath`.
3. Save the returned `savePath`.
4. Call `ChatGroupManager.downloadGroupSharedFile` with `groupId`, `fileId`,
   and `savePath`.

Shared-file samplers should use a longer file-transfer timeout than normal
metadata APIs, especially for `test-large-8mb.bin`.

## Validation

Run from `measured_app` after implementation:

```bash
yarn lint
yarn test
```

After adding `react-native-fs`, iOS dependencies must be installed before native
build validation:

```bash
cd ios
bundle exec pod install
```

Runtime validation should confirm that:

- helper routes return normal local paths;
- upload calls do not return before `onSuccess` or `onError`;
- download writes to the requested `savePath`;
- progress events do not produce extra WebSocket responses.

## Follow-Up

`BizChatManager` wrapper semantics are covered by a separate design. Broad
wrapper quality convergence is out of scope for this design.

## Self-Review

- Placeholder scan: no `TBD` or open placeholder remains.
- Scope check: this design is limited to group shared-file fixtures and
  upload/download wrapper behavior.
- Consistency check: fixture preparation happens through internal helpers;
  SDK wrappers still require explicit `filePath` and `savePath` from the
  caller.
