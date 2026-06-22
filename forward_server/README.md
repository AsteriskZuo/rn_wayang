# forward_server

`forward_server` 是 `rn_wayang` 的 WebSocket 转发服务。它不理解业务命令，
只负责把同一个 `topic` 下的测试驱动端消息转发给 `measured_app`，并把
`measured_app` 的响应转发回测试驱动端。

## 启动

```sh
cd forward_server
yarn install
yarn start
```

服务固定监听 `8083` 端口：

```text
ws://localhost:8083/iov/websocket/dual?topic=rn
```

`topic` 用于隔离连接组。JMeter、`client_demo` 和 `measured_app` 必须连接到
同一个 `topic`，默认是 `rn`。

## 转发模式

当前转发模式在 [index.js](index.js) 中通过 `const mode = 1` 固定配置。

- `mode = 0`：广播模式。任意连接发送的消息会转发给同组其他连接。
- `mode = 1`：请求/响应模式。第一个连接到某个 `topic` 的客户端会成为
  `initiator`；`initiator` 的消息会广播给其他连接，非 `initiator` 的消息只
  回复给 `initiator`。

JMeter 场景通常依赖 `mode = 1`：JMeter 作为第一个连接，`measured_app` 作为
后续连接，JMeter 发请求，`measured_app` 回响应。

切换模式需要修改 `index.js` 并重启服务。

## 手动客户端

可以用浏览器打开 [client_demo/index.html](client_demo/index.html) 做简单调试。
当前 demo 默认连接：

```text
ws://localhost:8083/iov/websocket/dual?topic=rn
```

如果要修改地址或 topic，编辑 [client_demo/app.js](client_demo/app.js) 中的
`host` 和 `topic`。

## 日志

服务会在控制台输出：

- 新建或销毁 `topic` 分组。
- WebSocket 连接建立和关闭。
- 收到的消息和转发目标。

这些日志只用于定位转发链路问题。业务成功或失败需要查看 JMeter 响应体和
`measured_app` 日志。
