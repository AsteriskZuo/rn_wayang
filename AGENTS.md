# AGENTS.md

本文件给 coding agent 提供在本仓库工作时需要优先知道的事实。用户面向的使用说明请看
顶级 [README.md](README.md) 和各子项目 README。
开发协作、分支模型和生成物维护流程以 [CONTRIBUTING.md](CONTRIBUTING.md) 为准。

## 仓库结构

本仓库由两个独立 Node/RN 子项目和一组 JMeter 测试计划组成。根目录没有
`package.json`，执行包管理命令时要进入对应子项目。

- `forward_server/`：Node.js WebSocket 转发服务，Express + `ws`，Yarn 4.9.1。
- `measured_app/`：React Native 0.83.2 / React 19.2.0 被测端应用，Yarn 4.14.1。
- `jmeter/`：Apache JMeter 5.6.3 测试计划和测试数据工具。

`forward_server/`、`measured_app/` 和 `jmeter/data-fixtures/` 都使用 Yarn Berry，
`nodeLinker: node-modules`。仓库根目录存在 `.pnp.cjs`，但这些子项目不使用 PnP。

## 常用命令

`forward_server/`：

- `yarn start`：执行 `node index.js`，监听 `:8083`。
- 浏览器打开 `client_demo/index.html` 可做手动 WebSocket 调试。

`measured_app/`：

- `yarn start`：启动 Metro。
- `yarn android` / `yarn ios`：构建并运行到模拟器或设备。
- iOS 首次运行或原生依赖变更后，在 `ios/` 下执行
  `bundle install && bundle exec pod install`。
- `yarn lint`：ESLint。
- `yarn test --watchman=false`：Jest。
- `yarn typecheck`：TypeScript 检查。

`jmeter/data-fixtures/`：

- `yarn prepare`：复制本地 REST 配置模板。
- `yarn prepare:accounts`：准备固定 fixture 账号。
- `yarn reset:relationships`：重置联系人、群组和聊天室关系数据。
- `yarn delete:accounts`：删除固定 fixture 账号和记录的关系状态。
- `yarn test`：运行 Node.js 测试。

## 整体架构

`rn_wayang` 的核心模型是 puppet 测试：`measured_app` 是运行在设备上的被测 puppet，
`forward_server` 是消息转发服务，JMeter `.jmx` 是常用测试驱动。

消息流：

```text
JMeter / client_demo  --ws-->  forward_server  --ws-->  measured_app
                       <--ws--                 <--ws--
```

1. 两端都连接
   `ws://<host>:8083/iov/websocket/dual?topic=<topic>`。`forward_server` 按
   `topic` 建立连接分组。
2. `forward_server/index.js` 中的 `const mode` 控制转发模式：
   - `mode = 0`：简单广播，消息转发给同组其他连接。
   - `mode = 1`：请求/响应模式，第一个连接是 `initiator`。`initiator` 广播给其他连接，
     非 `initiator` 只回复 `initiator`。当前默认是 `1`。
3. `measured_app/src/RNWS.ts` 是 WebSocket 单例客户端，默认 host 为 `localhost`、
   port 为 `8083`、topic 为 `rn`。这些值可通过 UI 修改，也可通过 Android extras 或
   iOS launch arguments 覆盖。
4. Android 自动启动参数示例：
   `adb shell am start -n com.rn_wayang/.MainActivity --es relayHost 10.0.2.2 --ei relayPort 8083 --es relayTopic rn --ez autoStart true`。
5. iOS 自动启动参数示例：
   `xcrun simctl launch booted org.reactjs.native.example.rn-wayang --relayHost 127.0.0.1 --relayPort 8083 --relayTopic rn --autoStart true`。
6. `RNWS` 收到消息后转发给注册的 `WSMessageListener`，并把 `RNWS.send` 作为
   `ReturnCallback` 传入。listener 必须调用 callback；无业务 payload 时传
   `undefined`，协议仍会返回成功响应。
7. `measured_app/src/Dispatch.ts` 是 `src/App.tsx` 目前注册的唯一 listener。它解析
   `{cmd, info}`，再分发给 `Biz*` wrapper。
8. `measured_app/src/biz/Biz*.ts` 是 `react-native-chat-sdk` API 的薄封装。新增远程命令时，
   优先沿用现有 Biz wrapper 和 `BizBase.tryCatch` 的响应模式。
9. 到达 Biz wrapper 的成功响应统一为 `{ok: true, value: ...}`。这里 `ok: true` 只表示
   请求到达 wrapper 并返回结果，不表示 SDK 业务成功。SDK 错误、业务错误和回调
   `onError` 都会放在 `value` 中。无效 JSON、未知命令等协议层错误返回
   `protocol_error`。

## 被测端入口

`measured_app/index.js` 注册的是 `./src/App`，不是仓库根目录的 `App.tsx`。根目录
`App.tsx` 是 React Native 模板遗留文件，运行中的被测端不会使用它。

`src/App.tsx` 当前 UI 包含：

- `HOST`、`PORT`、`TOPIC` 输入框。
- 单个连接按钮，状态为 `START`、`STARTING...`、`STOP`。
- 连接状态文本，展示 `stopped`、`starting`、`started` 和连接地址或错误详情。
- `RAW LOG` 和 `JSON LOG` 开关。

## 修改注意事项

- 不要在根目录执行 Yarn 命令；进入对应子项目。
- 切换 `forward_server` 的转发模式需要改源码并重启服务。
- `RNWS` 是单例。`App.tsx` 每次 start 前会清理并重新注册 `Dispatch` listener，避免重复监听。
- Android 模拟器访问宿主机服务通常用 `10.0.2.2`；iOS 模拟器通常用 `localhost` 或
  `127.0.0.1`。
- `react-native-chat-sdk` 有原生依赖；`yarn lint`、`yarn test` 和 `yarn typecheck`
  不能替代 Android/iOS 原生编译验证。
- JMeter 场景用例可能修改服务端状态。重复运行 mutating 场景前，按需执行
  `jmeter/data-fixtures` 的 `yarn reset:relationships`。
