# rn_wayang

`rn_wayang` 是一个用于验证 `react-native-chat-sdk` 的端到端测试工程。
它由三个可独立运行、但需要配合使用的部分组成：

- `forward_server/`：WebSocket 转发服务，负责在测试驱动端和被测端之间转发消息。
- `measured_app/`：React Native 被测端应用，连接转发服务并执行远程 SDK 命令。
- `jmeter/`：JMeter 测试计划，通过转发服务驱动被测端应用。

整体消息流：

```text
JMeter / client_demo  --ws-->  forward_server  --ws-->  measured_app
                       <--ws--                 <--ws--
```

## 快速运行

推荐启动顺序：

1. 启动 `forward_server`。
2. 启动 `measured_app` 的 Metro 和 Android/iOS 应用。
3. 让 `measured_app` 连接到转发服务。
4. 执行 `jmeter` 测试计划。

### 1. 启动转发服务

```sh
cd forward_server
yarn install
yarn start
```

默认监听地址：

```text
ws://localhost:8083/iov/websocket/dual?topic=rn
```

详细说明见 [forward_server/README.md](forward_server/README.md)。

### 2. 启动被测端应用

```sh
cd measured_app
yarn install
yarn start
```

另开终端安装并启动应用：

```sh
cd measured_app
yarn android
```

或：

```sh
cd measured_app
yarn ios
```

应用内可以手动填写 `HOST`、`PORT`、`TOPIC`，点击 `START` 连接转发服务。
Android 模拟器访问宿主机转发服务时，`HOST` 通常填写 `10.0.2.2`。
iOS 模拟器访问宿主机转发服务时，`HOST` 通常填写 `localhost` 或 `127.0.0.1`。

也可以通过自动化启动参数直接连接转发服务：

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

```sh
xcrun simctl launch booted org.reactjs.native.example.rn-wayang \
  --relayHost 127.0.0.1 \
  --relayPort 8083 \
  --relayTopic rn \
  --autoStart true \
  --rawLog true \
  --jsonLog true
```

详细说明见 [measured_app/README.md](measured_app/README.md)。

### 3. 执行 JMeter 测试

前置要求：

- Apache JMeter 5.6.3。
- 已安装 WebSocket Samplers 插件，测试计划使用
  `eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler`。
- `forward_server` 正在运行。
- `measured_app` 已连接到同一个 `topic`。

运行单个测试计划示例：

```sh
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-chat-client.jmx \
  -l /tmp/rn-sdk-chat-client.jtl \
  -j /tmp/rn-sdk-chat-client.log \
  -Jurl="${JMETER_URL:-localhost}" \
  -Jport="${JMETER_PORT:-8083}" \
  -Jtimeout="${JMETER_TIMEOUT:-10000}" \
  -Jtopic="${JMETER_TOPIC:-rn}" \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

场景用例通常依赖 `jmeter/data-fixtures` 生成的账号、联系人、群组或聊天室状态。
执行前请先阅读 [jmeter/README.md](jmeter/README.md)。

## 文档入口

- [forward_server/README.md](forward_server/README.md)：转发服务启动、协议路径、topic 和转发模式。
- [measured_app/README.md](measured_app/README.md)：被测端 UI、Android/iOS 启动参数、日志开关和调试命令。
- [jmeter/README.md](jmeter/README.md)：测试数据准备、JMX 生成、CLI 执行和结果检查。
- [AGENTS.md](AGENTS.md)：给 coding agent 使用的项目事实和修改注意事项。
