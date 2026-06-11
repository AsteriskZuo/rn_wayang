# RN Chat SDK Biz and Dispatch Alignment Design

## Context

`measured_app` exposes `react-native-chat-sdk` APIs through `Biz*.ts` wrappers
and generated dispatch routes. The original audit reported 222 active SDK
Promise APIs, 263 Biz static methods, and 125 generated active routes. Many
missing routes were caused by Biz methods using historical names while calling
newer SDK methods internally, for example `addGroupAdmin` calling
`ChatGroupManager.addAdmin`.

The generated dispatch files should be derived from SDK-active method names and
the Biz wrappers should use those same method names. Route commands are
manager-qualified as `SdkClass.method` (for example `ChatGroupManager.addAdmin`)
so methods with the same name on different SDK managers do not collide. This
task intentionally does not preserve old command aliases.

## Decisions

- Use SDK active Promise API method names as the source of truth for Biz wrapper
  names.
- Use manager-qualified SDK command names as the generated dispatch protocol.
- Rename or replace old Biz wrapper names with SDK-consistent names.
- Do not generate old command aliases for compatibility.
- Keep protocol/internal helpers, listener helpers, and the deprecated
  `ChatClient.login` setup route outside generated SDK coverage.
- Fix dispatch generation before broad Biz alignment so generated files are not
  hand-edited.
- Add generated unknown-command logging to every generated dispatch function,
  with a `logUnknown` flag so top-level dispatch probing can suppress per-route
  warnings until every generated route has been tried.

## Dispatch Generator

`measured_app/scripts/generate-dispatch-routes.js` renders generated route files
with a `Logger` import, manager-qualified cases like
`ChatGroupManager.addAdmin`, and a default branch like:

```typescript
if (logUnknown) {
  Logger.raw.warn(`ChatGroupManager: unknown cmd: ${cmd}`);
}
return false;
```

This replaces ad hoc edits to individual generated files. After the script
change, `yarn generate:dispatch` will refresh every
`measured_app/src/dispatch/*.generated.ts` file and `src/dispatch/index.ts`.

The generator will continue to route only active, non-deprecated SDK Promise
methods that have same-name static Biz wrappers. It will not route mismatch
names such as `addGroupAdmin`; those are Biz wrapper defects to fix by
renaming/replacing them with SDK names such as `addAdmin`.

`measured_app/src/Dispatch.ts` tries each generated SDK route with
`logUnknown = false`, then falls back to `dispatchInternal`. If nothing handles
the command, it emits one top-level `Dispatch: unknown cmd` warning. This avoids
false warnings from generated dispatchers that correctly reject commands for
other managers.

## Biz Wrapper Alignment

Each `measured_app/src/biz/Biz*.ts` file will be checked against the audit
missing-wrapper output and local SDK declarations under
`measured_app/node_modules/react-native-chat-sdk/lib/typescript/src`.

For each active SDK Promise API:

- If an equivalent old wrapper exists, rename it to the SDK method name and
  keep its reviewed parameter mapping where it matches the SDK signature.
- If no equivalent wrapper exists, add a thin wrapper using the existing local
  style:

```typescript
static sdkMethodName(info: any, callback: ReturnCallback): void {
  BizBase.tryCatch(
    ChatClient.getInstance().manager.sdkMethodName(/* mapped info fields */),
    callback,
    ChatClient.getInstance().manager.sdkMethodName.name,
  );
}
```

- If a wrapper maps multiple parameters, enum-like values, message objects,
  group/room options, push options, presence payloads, or historical `info`
  aliases, review the SDK signature before editing and summarize the mapping in
  the completion notes.
- Deprecated SDK APIs are not added as normal wrappers. Existing deprecated
  wrappers are removed unless they are required protocol exceptions.

## Generated Dispatch Output

After Biz alignment, generated dispatch files should include cases for
manager-qualified SDK method names such as `ChatGroupManager.addAdmin`,
`ChatManager.createChatThread`, and `ChatClient.getAccessToken`, not historical
names such as `addGroupAdmin`, `createThread`, or `accessToken`.

The audit's `possible legacy or implementation mismatch wrappers` section is
used as review input. A wrapper-call mismatch is not fixed by adding an alias to
generated dispatch; it is fixed by making the Biz method name match the SDK
method it calls, or by correcting an actual implementation mismatch.

## Validation

Run these commands from `measured_app`:

```bash
yarn generate:dispatch
yarn audit:chat-sdk-api
yarn lint
yarn test
```

Expected final state:

- `yarn audit:chat-sdk-api` exits 0.
- `missing active wrappers` is empty or only contains intentionally deferred
  APIs called out in the final report.
- `generated dispatch coverage` shows all active same-name wrappers routed.
- Deprecated normal wrappers are removed or explicitly justified.
- Generated dispatch files include uniform manager-qualified unknown-command
  logging.
- Lint and Jest pass.

Verified final audit state:

- active SDK Promise APIs: 222
- Biz static methods: 269
- generated active routes: 221
- missing active wrappers: none
- deprecated wrappers present: none
- routes without active SDK method: 0
