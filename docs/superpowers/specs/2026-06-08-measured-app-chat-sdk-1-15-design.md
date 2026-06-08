# measured_app Chat SDK 1.15.0 Upgrade Design

## Purpose

Update `measured_app` as the remote-controlled test target for `react-native-chat-sdk@1.15.0`.
The package version is already installed locally as `1.15.0`; this work focuses on keeping the app's command surface aligned with the SDK API changes.

JMeter plans are outside this task. They will be updated and integrated later. This task is complete when `measured_app` passes static validation and the app-side logging needed for later JMeter integration is in place.

## Current Architecture

The running app entry point is `measured_app/src/App.tsx`, registered by `measured_app/index.js`.

Remote commands enter through `RNWS.ts`, are parsed and routed by `Dispatch.ts`, and are handled by static methods on the `Biz*` classes:

- `BizChatClient`
- `BizChatManager`
- `BizChatGroupManager`
- `BizChatRoomManager`
- `BizChatContactManager`
- `BizChatPresenceManager`
- `BizChatPushManager`
- `BizChatUserInfoManager`

The existing wrapper pattern is intentionally thin:

1. `Dispatch` parses `{cmd, info}`.
2. A `case` calls one static Biz method.
3. The Biz method extracts fields from `info`.
4. It calls the corresponding SDK manager method.
5. `BizBase.tryCatch` resolves or rejects into the WebSocket callback.

The upgrade should preserve this shape.

## Scope

Use incremental coverage for SDK 1.15.0:

- Keep the existing command protocol and command names.
- Keep existing Biz wrapper classes and static methods.
- Add or adjust wrappers for SDK 1.15.0 public APIs that are currently missing or have changed.
- Prefer SDK 1.15.0 replacement APIs over deprecated aliases when adding new commands.
- Do not update `measured_app/jmeter/data/*.jmx`.
- Do not restructure `Dispatch.ts` into a new routing framework in this task.

The API inventory source of truth is the local SDK type declarations:

`measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/*.d.ts`

## Execution Order

Work must be done in two phases:

1. **API sync first**
   Update Biz wrappers and `Dispatch.ts`, then run static validation.

2. **Logging second**
   Add the logger module and replace centralized logging points, then run static validation again.

This keeps the API upgrade and logging change separable during review and debugging.

## Logging Design

Add a small logger module with a console-compatible API:

```ts
Logger.raw.log(...args);
Logger.raw.warn(...args);
Logger.raw.error(...args);

Logger.json.log(...args);
Logger.json.warn(...args);
Logger.json.error(...args);
```

Both layers are disabled by default.

`Logger.raw` controls low-level WebSocket and connection logs that currently live in `RNWS.ts`. It is for transport-level checks such as open, close, error, send, and receive timing.

`Logger.json` controls protocol-level logs. It should decode or normalize payloads so JMeter integration can inspect readable strings and JSON instead of Buffer-style output. It should be used at centralized interception points:

- `RNWS.ts`: log decoded inbound and outbound payloads.
- `Dispatch.ts`: log parsed `cmd` and `info`, plus parse failures.
- `BizBase.tryCatch`: log SDK method success and failure in one place.

The logger should not require adding one-off log calls inside every API wrapper.

The app UI should expose simple controls for the two independent switches:

- raw logging on/off
- JSON logging on/off

## Validation

The completion target for this task is static validation in `measured_app`:

```bash
yarn lint
yarn test
```

Native Android/iOS execution and JMeter integration are deferred because `react-native-chat-sdk` has native dependencies and the JMeter work is intentionally separate.

## Skill Decision

Do not create a reusable Codex skill before this implementation. After this upgrade is complete, the actual process can be condensed into a future skill that covers:

- extracting SDK public API declarations,
- comparing against Biz wrappers and Dispatch commands,
- applying the local wrapper naming conventions,
- validating the app,
- using app-side decoded logs during JMeter integration.

This avoids creating an abstract skill before the upgrade workflow has been proven once.
