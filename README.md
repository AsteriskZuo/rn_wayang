# rn_wayang

`rn_wayang` 是一个 React Native SDK 测试工程。`measured_app` 作为设备侧被测应用运行，
`forward_server` 负责转发 WebSocket 消息，JMeter 通过转发服务驱动测试用例。

仓库结构：

- `forward_server/` - Node.js WebSocket 转发服务，用于在测试驱动端和 React Native 应用之间转发消息。
- `measured_app/` - React Native 被测应用，通过远程命令暴露 `react-native-chat-sdk` 能力。
- `jmeter/` - JMeter 测试计划和相关配置，用于通过转发服务驱动被测应用。
- `docs/` - 项目说明和补充文档。

## 简要使用说明

推荐启动顺序：

1. 启动 `forward_server`。
2. 编译并运行 `measured_app`，点击应用内的 `START` 连接转发服务。
3. 使用 JMeter 执行 `jmeter/data/*.jmx` 测试计划。

### 使用 forward_server 运行 转发服务

```sh
cd forward_server
yarn install
yarn start
```

服务默认监听 `8083` 端口，WebSocket 路径为：

```text
ws://localhost:8083/iov/websocket/dual?topic=rn
```

当前转发模式在 `forward_server/index.js` 中通过 `const mode = 1` 固定配置。
`mode = 1` 时，第一个连接为 initiator，其他连接只回复 initiator。

### 使用 measured_app 运行 被测应用

前置要求：已完成 React Native Android/iOS 开发环境配置，Node.js 版本满足 `>=20`。

```sh
cd measured_app
yarn install
yarn start
```

另开一个终端编译并安装到模拟器或真机：

```sh
cd measured_app
yarn android
```

或：

```sh
cd measured_app
yarn ios
```

iOS 首次运行或原生依赖变更后，需要先安装 Pods：

```sh
cd measured_app/ios
bundle install
bundle exec pod install
```

默认 WebSocket 地址在 `measured_app/src/RNWS.ts` 中配置为
`ws://localhost:8083/iov/websocket/dual?topic=rn`。如果转发服务不在本机，
需要同步修改这里的 `host`。

### 使用 jmeter 执行测试用例

前置要求：Apache JMeter 5.6.3，并安装 WebSocket Samplers 插件
（测试计划中使用 `eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler`）。

测试计划位于 `jmeter/data/`，默认连接参数为：

- `url`: `localhost`
- `port`: `8083`
- `topic`: `rn`

#### UI 模式

```sh
jmeter
```

在 JMeter 图形界面中打开 `jmeter/data/*.jmx` 文件，按需修改
`User Defined Variables` 中的服务地址、账号和密码，然后点击运行。

#### CLI 模式

```sh
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-chat-client.jmx \
  -l /tmp/rn-sdk-chat-client.jtl \
  -j /tmp/rn-sdk-chat-client.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

将 `-t` 后的文件替换为其他 `jmeter/data/*.jmx` 即可执行对应模块用例。
如需修改服务地址或测试账号，先在对应 JMX 的 `User Defined Variables`
中调整后再运行 CLI。
