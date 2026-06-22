# measured_app 贡献指南

本文档面向维护 `measured_app` 的开发者。运行和调试入口见
[README.md](README.md)。

## 代码边界

主要目录：

- `src/App.tsx`：被测端 UI、连接配置、日志开关和自动启动逻辑。
- `src/RNWS.ts`：WebSocket 单例客户端和连接状态机。
- `src/Dispatch.ts`：远程命令入口，解析 `{cmd, info}` 并调用 dispatch routes。
- `src/dispatch/Internal.ts`：内部命令路由，例如 init、login、logout 等。
- `src/dispatch/*.generated.ts`：生成的 SDK manager 路由，不手工修改。
- `src/dispatch/Response.ts`：统一协议响应 helper。
- `src/biz/Biz*.ts`：`react-native-chat-sdk` API wrapper。
- `scripts/generate-dispatch-routes.js`：根据 SDK 类型声明和 Biz wrapper 生成 dispatch 路由。

## 新增或修复 SDK wrapper

新增远程 SDK API 时，优先按以下顺序修改：

1. 在对应 `src/biz/Biz*.ts` 中添加或修复 static wrapper。
2. wrapper 命名尽量与 SDK method 名保持一致。
3. Promise 型 SDK API 使用 `BizBase.tryCatch(promise, callback, tag)`。
4. callback/delegate、文件路径 helper、测试辅助逻辑不要暴露为 generated SDK route。
5. 运行 `yarn generate:dispatch`。
6. 检查 `src/dispatch/*.generated.ts` 和 `src/dispatch/index.ts` 的 diff。
7. 运行 `yarn audit:chat-sdk-api`。
8. 补充或更新 Jest 测试。

示例命令：

```sh
cd measured_app
yarn generate:dispatch
yarn audit:chat-sdk-api
yarn test --watchman=false
yarn lint
yarn typecheck
```

## Dispatch 生成规则

`src/dispatch/*.generated.ts` 和 `src/dispatch/index.ts` 是生成物。不要直接手工编辑。

生成器输入：

- SDK 类型声明：
  `node_modules/react-native-chat-sdk/lib/typescript/src/*.d.ts`
- Biz wrapper：
  `src/biz/Biz*.ts`
- 生成规则：
  `scripts/generate-dispatch-routes.js`

生成器输出：

- `src/dispatch/ChatClient.generated.ts`
- `src/dispatch/ChatManager.generated.ts`
- `src/dispatch/ChatGroupManager.generated.ts`
- `src/dispatch/ChatRoomManager.generated.ts`
- `src/dispatch/ChatContactManager.generated.ts`
- `src/dispatch/ChatPresenceManager.generated.ts`
- `src/dispatch/ChatPushManager.generated.ts`
- `src/dispatch/ChatUserInfoManager.generated.ts`
- `src/dispatch/index.ts`

生成后必须 review diff，确认：

- route 名是 manager-qualified 形式，例如 `ChatUserInfoManager.updateOwnUserInfo`。
- 新增 route 对应真实 Biz wrapper。
- deprecated API 只有在生成器白名单明确允许时才生成。
- 没有因为 wrapper 改名误删稳定 route。

## 协议响应规则

远程命令成功到达 Biz wrapper 后，响应通常是：

```json
{"ok":true,"value":...}
```

注意：

- `ok: true` 不表示 SDK 业务成功。
- SDK resolve、reject、业务错误和 callback `onError` 都通过 `value` 表达。
- 无效 JSON、缺少 `cmd`、未知命令等协议层问题返回 `protocol_error`。
- listener 必须调用 callback；没有业务 payload 时传 `undefined`。

修改 `Dispatch.ts`、`Response.ts` 或 `RNWS.ts` 时，要优先补充响应协议相关测试。

## UI 和启动参数

UI 支持：

- `HOST`
- `PORT`
- `TOPIC`
- `START` / `STARTING...` / `STOP`
- `RAW LOG`
- `JSON LOG`

启动参数支持：

| React Native prop | Android extra | iOS argument |
| --- | --- | --- |
| `relayHost` | `--es relayHost` | `--relayHost` |
| `relayPort` | `--ei relayPort` | `--relayPort` |
| `relayTopic` | `--es relayTopic` | `--relayTopic` |
| `autoStart` | `--ez autoStart` | `--autoStart` |
| `rawLog` | `--ez rawLog` | `--rawLog` |
| `jsonLog` | `--ez jsonLog` | `--jsonLog` |

修改这些参数时，必须同步检查：

- `src/App.tsx`
- `android/app/src/main/java/com/rn_wayang/MainActivity.kt`
- `ios/rn_wayang/AppDelegate.swift`
- `__tests__/PuppetApp.launch-config.test.tsx`
- `__tests__/IOSLaunchConfig.test.ts`
- [README.md](README.md)

## 原生代码修改

涉及 Android 原生代码时运行：

```sh
cd measured_app/android
./gradlew :app:compileDebugKotlin
```

涉及 iOS 原生代码时运行：

```sh
cd measured_app/ios
xcodebuild \
  -workspace rn_wayang.xcworkspace \
  -scheme rn_wayang \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  build
```

Android 和 iOS 都依赖 `react-native-chat-sdk` 原生部分。`yarn test`、`yarn lint`、
`yarn typecheck` 不能替代原生编译。

## 测试策略

常规 JS 验证：

```sh
cd measured_app
yarn test --watchman=false
yarn lint
yarn typecheck
```

建议按修改范围选择额外验证：

- 修改 `RNWS.ts`：跑 `__tests__/RNWS.response.test.ts`，并用实际被测端连接转发服务验证。
- 修改 `Dispatch.ts` 或 `src/dispatch/Response.ts`：跑 `Dispatch.response.test.ts` 和
  `Response.test.ts`。
- 修改 Biz wrapper：跑对应 `Biz*.response.test.ts` 或新增测试。
- 修改文件路径 helper：跑 `FileHelper.test.ts` 和相关 file-helper 测试。
- 修改启动参数：跑 `PuppetApp.launch-config.test.tsx` 和 `IOSLaunchConfig.test.ts`。

单测示例：

```sh
cd measured_app
yarn test __tests__/RNWS.response.test.ts --watchman=false
```

## SDK 升级流程

升级 `react-native-chat-sdk` 或其类型声明后：

1. 安装或替换依赖包。
2. 运行：

   ```sh
   cd measured_app
   yarn audit:chat-sdk-api
   ```

3. 根据 audit 输出补齐或调整 Biz wrapper。
4. 运行：

   ```sh
   yarn generate:dispatch
   yarn audit:chat-sdk-api
   yarn test --watchman=false
   yarn lint
   yarn typecheck
   ```

5. review generated dispatch diff。
6. 如果 native 依赖变化，运行 Android/iOS 编译检查。
7. 如果远程命令覆盖发生变化，同步更新 JMeter 测试计划或场景生成器。

## 提交前检查

提交前至少确认：

```sh
cd measured_app
yarn test --watchman=false
yarn lint
yarn typecheck
```

如果运行过 `yarn generate:dispatch`，提交时同时包含：

- 修改的 Biz wrapper 或生成器。
- 更新后的 `src/dispatch/*.generated.ts`。
- 更新后的 `src/dispatch/index.ts`。
- 相关测试。

不要提交：

- Metro 缓存。
- Android/iOS 构建产物。
- 本地 SDK tarball 以外的临时测试文件。
