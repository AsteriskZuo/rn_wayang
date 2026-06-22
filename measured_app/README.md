# measured_app

`measured_app` 是 `rn_wayang` 的 React Native 被测端应用。它连接
`forward_server`，接收 JMeter 或 `client_demo` 发来的远程命令，并通过
`react-native-chat-sdk` 执行对应 SDK API。

维护 Biz wrapper、generated dispatch、原生启动参数或 SDK 升级流程时，请阅读
[CONTRIBUTING.md](CONTRIBUTING.md)。

## 入口和架构

运行入口是 [index.js](index.js) 注册的 `./src/App`，不是仓库根目录的
`App.tsx`。

主要模块：

- [src/App.tsx](src/App.tsx)：被测端 UI，负责配置转发服务地址、启动/停止连接、
  控制日志开关。
- [src/RNWS.ts](src/RNWS.ts)：WebSocket 单例客户端，维护 `stopped`、
  `starting`、`started` 三种连接状态。
- [src/Dispatch.ts](src/Dispatch.ts)：解析 `{cmd, info}` 命令并分发到 Biz 层。
- `src/biz/Biz*.ts`：`react-native-chat-sdk` 的薄封装，统一把 SDK 调用结果返回给
  WebSocket 请求方。

成功分发到 Biz wrapper 的响应形态通常是：

```json
{"ok":true,"value":...}
```

这里的 `ok: true` 只表示命令到达被测端 wrapper 并得到返回，不表示 SDK 业务一定成功。
SDK 错误、业务错误和回调 `onError` 都会放在 `value` 中。

## 启动开发服务

```sh
cd measured_app
yarn install
yarn start
```

`yarn start` 启动 Metro，默认监听 `8081`。

## Android

编译并安装：

```sh
cd measured_app
yarn android
```

Android 模拟器访问宿主机的 `forward_server` 时，host 使用 `10.0.2.2`。

可以手动打开应用，在 UI 中填写：

- `HOST`: `10.0.2.2`
- `PORT`: `8083`
- `TOPIC`: `rn`

然后点击 `START`。

也可以通过 adb 传入启动参数并自动连接：

```sh
adb shell am start \
  -n com.rn_wayang/.MainActivity \
  --es relayHost 10.0.2.2 \
  --ei relayPort 8083 \
  --es relayTopic rn \
  --ez autoStart true \
  --ez rawLog true \
  --ez jsonLog true
```

关闭应用：

```sh
adb shell am force-stop com.rn_wayang
```

查看被测端日志示例：

```sh
adb logcat | rg 'RNWS|ReactNativeJS|rn_wayang'
```

## iOS

首次运行或原生依赖变更后安装 Pods：

```sh
cd measured_app/ios
bundle install
bundle exec pod install
```

编译并启动：

```sh
cd measured_app
yarn ios
```

iOS 模拟器访问宿主机的 `forward_server` 时，host 通常使用 `localhost` 或
`127.0.0.1`。

可以通过 `simctl launch` 传入启动参数并自动连接：

```sh
xcrun simctl launch booted org.reactjs.native.example.rn-wayang \
  --relayHost 127.0.0.1 \
  --relayPort 8083 \
  --relayTopic rn \
  --autoStart true \
  --rawLog true \
  --jsonLog true
```

关闭应用：

```sh
xcrun simctl terminate booted org.reactjs.native.example.rn-wayang
```

切换模拟器主题：

```sh
xcrun simctl ui booted appearance light
xcrun simctl ui booted appearance dark
```

## UI 操作

应用主界面提供：

- `HOST`：转发服务主机名或 IP。
- `PORT`：转发服务端口，默认 `8083`。
- `TOPIC`：连接分组，默认 `rn`。
- 状态文本：显示 `stopped`、`starting`、`started` 和当前连接地址。
- 单个连接按钮：`START`、`STARTING...`、`STOP`。
- `RAW LOG` 开关：控制原始连接日志。
- `JSON LOG` 开关：控制收发 JSON 日志。

修改 `HOST`、`PORT` 或 `TOPIC` 后，需要重新点击 `START` 才会使用新连接参数。

## 启动参数

Android extras 和 iOS launch arguments 会映射为 React Native initial props：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `relayHost` | string | 转发服务 host。 |
| `relayPort` | number | 转发服务端口。 |
| `relayTopic` | string | WebSocket topic。 |
| `autoStart` | boolean | 应用启动后自动连接。 |
| `rawLog` | boolean | 启用原始连接日志。 |
| `jsonLog` | boolean | 启用 JSON 收发日志。 |

iOS 布尔值支持 `true/false`、`1/0`、`yes/no`。

## 常用验证命令

```sh
cd measured_app
yarn test --watchman=false
yarn lint
yarn typecheck
```

Android 原生编译检查：

```sh
cd measured_app/android
./gradlew :app:compileDebugKotlin
```

iOS 模拟器编译检查：

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
