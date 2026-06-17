# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Repository layout

Two independent app/server sub-projects plus root-level JMeter test plans. There is no root `package.json`. Run package commands from inside each sub-project.

- `forward_server/` — Node.js WebSocket relay (Express + `ws`). Yarn 4.9.1.
- `measured_app/` — React Native 0.83.2 / React 19.2.0 app driven by the relay. Yarn 4.14.1.
- `jmeter/` — Apache JMeter 5.6.3 test plans that drive the app through the relay.

Both use Yarn Berry with `nodeLinker: node-modules` and a pinned yarn release in `.yarn/releases/`. There is a top-level `.pnp.cjs` from yarn but the sub-projects do not use PnP.

## Common commands

`forward_server/`:
- `yarn start` — `node index.js`, listens on `:8083`.
- Open `client_demo/index.html` in a browser to drive it manually.

`measured_app/`:
- `yarn start` — Metro bundler.
- `yarn android` / `yarn ios` — build + run on simulator/device. iOS first time: `bundle install && bundle exec pod install` in `ios/`.
- `yarn lint` — ESLint (`@react-native/eslint-config`).
- `yarn test` — Jest (`preset: react-native`). Run a single test: `yarn test __tests__/App.test.tsx` or `yarn test -t "<name pattern>"`.

## Big-picture architecture

The app's name (`wayang` = puppet) describes the system: `measured_app` is a remote-controlled puppet that exposes the `react-native-chat-sdk` (Agora Chat) surface to external test drivers. `forward_server` is the relay between driver and puppet. JMeter `.jmx` plans in `jmeter/data/` are the typical drivers.

Message flow:

```
JMeter / client_demo  ──ws──►  forward_server  ──ws──►  measured_app
                       ◄──ws──                 ◄──ws──
```

1. Both sides connect via `ws://<host>:8083/iov/websocket/dual?topic=<group>`. The server creates a `Map` per `topic` query param (see `forward_server/index.js`).
2. `forward_server` runs in one of two modes (hardcoded `const mode` in `index.js`):
   - `mode = 0` — simple broadcast: any message is forwarded to every other peer in the topic.
   - `mode = 1` — reply mode: the first connection in a topic is designated `isInitiator`; the initiator broadcasts to all others, non-initiators reply only to the initiator. Current default.
3. `measured_app/src/RNWS.ts` is a singleton WebSocket client. Its address (`localhost:8083`, topic `rn`) is hardcoded — change here when testing against a non-local server.
4. `RNWS` forwards each inbound message to registered `WSMessageListener`s and passes `RNWS.send` as the `ReturnCallback`. Listeners MUST invoke the callback (with `undefined` if there's no payload) — the protocol assumes a reply per request.
5. `measured_app/src/Dispatch.ts` is the only listener wired up in `src/App.tsx`. It parses incoming JSON as `{cmd, info}` and switches on `cmd` to dispatch into the `Biz*` managers. Adding a new remote command means adding a case here and a matching static method on the appropriate `Biz*` class.
6. `measured_app/src/biz/Biz*.ts` are thin static wrappers around `react-native-chat-sdk` APIs (`BizChatClient`, `BizChatManager`, `BizChatGroupManager`, `BizChatRoomManager`, `BizChatContactManager`, `BizChatPresenceManager`, `BizChatPushManager`, `BizChatUserInfoManager`). They all extend `BizBase`, which provides `tryCatch(promise, callback, tag)` to unify resolve/reject into a single callback invocation. New SDK wrappers should follow this pattern, not throw.
7. Successful dispatch to a target API wrapper returns the unified API response shape `{ok: true, value: ...}`. Here `ok: true` means the request reached a measured app API wrapper and returned an API result; it does **not** mean the SDK operation succeeded. SDK successes, SDK errors, business errors, and SDK callback `onError` values are all carried in `value`. Requests that fail before reaching a wrapper, such as invalid JSON, invalid `cmd`, or unknown commands, return a `protocol_error` response, not `ok: false`.

## App entry point

`measured_app/index.js` registers `./src/App` (the puppet UI with START/STOP buttons and a log area), **not** the root-level `App.tsx` (which is the stock RN `NewAppScreen`). The root `App.tsx` is unused in the running app — don't edit it expecting changes to appear.

## Notes when modifying

- The `forward_server` mode is a `const` in `index.js`. Switching modes requires editing the source, not config.
- `RNWS` is a singleton (`RNWS.getInstance()`); `App.tsx` clears + re-adds the listener on every START tap to avoid duplicate handlers.
- `react-native-chat-sdk` (Agora Chat) has native dependencies — Android/iOS builds will fail without proper native setup; `yarn lint`/`yarn test` do not exercise the SDK.
