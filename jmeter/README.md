# JMeter

`jmeter/` 保存用于驱动 `measured_app` 的 Apache JMeter 测试计划和相关工具。
JMeter 通过 `forward_server` 发送 WebSocket 请求，被测端应用执行
`react-native-chat-sdk` API 后返回响应。

维护 JMX、场景生成器或 data-fixtures 时，请阅读
[CONTRIBUTING.md](CONTRIBUTING.md)。

- 推荐版本：Apache JMeter 5.6.3。
- 测试计划目录：`jmeter/data/`。
- WebSocket Samplers 插件：测试计划使用
  `eu.luminis.jmeter.wssampler.RequestResponseWebSocketSampler`。

## 数据准备

部分场景用例依赖固定账号、联系人、群组或聊天室。相关数据由
`jmeter/data-fixtures/` 这个独立 Node.js helper 包准备。

详细字段、安全策略和输出文件说明见
[data-fixtures/README.md](data-fixtures/README.md)。

### 配置 REST 访问

```sh
cd jmeter/data-fixtures
yarn prepare
```

编辑生成的 `config.local.cjs`，填写 REST app token、fixture 前缀和默认密码。
`config.local.cjs` 被 git 忽略。

### 准备账号

Fixture 账号是持久账号，不需要每次运行测试前都重建。

```sh
cd jmeter/data-fixtures
yarn prepare:accounts
```

### 重置关系数据

运行依赖联系人、群组或聊天室的场景前，先重置关系数据：

```sh
cd jmeter/data-fixtures
yarn reset:relationships
```

重置会创建：

- 固定联系人关系。
- 一个 GroupManager 场景使用的公开群组。
- 一个 ChatRoomManager 场景使用的聊天室。
- `relationships.env` 中的准备完成标记。

会修改关系状态的场景重复运行前，也建议重新执行 `reset:relationships`。

### 删除账号

```sh
cd jmeter/data-fixtures
yarn delete:accounts
```

## 测试计划生成

这一步只在场景定义或生成器代码变化时需要执行。生成出来的场景 `.jmx` 文件不要手工编辑，
否则下次生成会覆盖改动。

ChatManager 场景：

```sh
node jmeter/tools/chat_manager_scenarios/generate.js
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
```

ContactManager 场景：

```sh
node jmeter/tools/contact_manager_scenarios/generate.js
node --test jmeter/tools/contact_manager_scenarios/generate.test.js
```

GroupManager 场景：

```sh
node jmeter/tools/group_manager_scenarios/generate.js
node --test jmeter/tools/group_manager_scenarios/generate.test.js
```

ChatRoomManager 场景：

```sh
node jmeter/tools/chat_room_manager_scenarios/generate.js
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
```

ChatUserInfoManager 场景：

```sh
node jmeter/tools/user_info_manager_scenarios/generate.js
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

## 执行前置条件

- `forward_server` 正在运行，默认监听 `localhost:8083`。
- `measured_app` 已启动，并连接到同一个 `topic`。
- JMeter 与 `measured_app` 使用的 `topic` 一致，默认是 `rn`。
- 依赖 fixture 的场景已经完成 `prepare:accounts` 和 `reset:relationships`。

`url` 和 `port` 指向 `forward_server`。`topic` 必须与 `measured_app` UI 或启动参数中的
`relayTopic` 一致。

## 执行顶层测试计划

运行单个顶层测试计划并保存完整 XML 结果、响应数据和 sampler 数据：

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
  -JappKey="${APP_KEY:-easemob-demo#zuoyu}" \
  -Jusername="${CHAT_USERNAME:-asterisk001}" \
  -Jpassword="${CHAT_PASSWORD:-qwerty}" \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

运行当前所有顶层测试计划：

```sh
rm -rf /tmp/rn-wayang-top-level
mkdir -p /tmp/rn-wayang-top-level
for f in jmeter/data/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-top-level/${name}.jtl" \
    -j "/tmp/rn-wayang-top-level/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JappKey="${APP_KEY:-easemob-demo#zuoyu}" \
    -Jusername="${CHAT_USERNAME:-asterisk001}" \
    -Jpassword="${CHAT_PASSWORD:-qwerty}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

## 执行场景测试计划

ChatManager：

```sh
rm -rf /tmp/rn-wayang-chat-manager-scenarios
mkdir -p /tmp/rn-wayang-chat-manager-scenarios
for f in jmeter/data/chat-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-chat-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-chat-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JappKey="${APP_KEY:-easemob-demo#zuoyu}" \
    -Jusername="${CHAT_USERNAME:-asterisk001}" \
    -Jpassword="${CHAT_PASSWORD:-qwerty}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

ContactManager：

```sh
rm -rf /tmp/rn-wayang-contact-manager-scenarios
mkdir -p /tmp/rn-wayang-contact-manager-scenarios
for f in jmeter/data/contact-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-contact-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-contact-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${CONTACT_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${CONTACT_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

GroupManager：

```sh
rm -rf /tmp/rn-wayang-group-manager-scenarios
mkdir -p /tmp/rn-wayang-group-manager-scenarios
for f in jmeter/data/group-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-group-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-group-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -JfileTimeout="${JMETER_FILE_TIMEOUT:-60000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${GROUP_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${GROUP_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

ChatRoomManager：

```sh
rm -rf /tmp/rn-wayang-chat-room-manager-scenarios
mkdir -p /tmp/rn-wayang-chat-room-manager-scenarios
for f in jmeter/data/chat-room-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-chat-room-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-chat-room-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${ROOM_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${ROOM_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

ChatUserInfoManager：

```sh
rm -rf /tmp/rn-wayang-user-info-manager-scenarios
mkdir -p /tmp/rn-wayang-user-info-manager-scenarios
for f in jmeter/data/user-info-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  echo name=$name
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-user-info-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-user-info-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${USER_INFO_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${USER_INFO_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

## 全量执行说明

可以用 `find jmeter/data -name '*.jmx'` 执行所有顶层和场景测试计划，但这不是日常推荐入口。
部分场景会修改联系人、群组、聊天室或用户信息状态，连续混跑可能互相污染状态。

如果确实需要全量跑，建议按模块分批执行，并在依赖 fixture 的模块之间按需执行：

```sh
cd jmeter/data-fixtures
yarn reset:relationships
```

## 结果检查

检查某个输出目录下是否有失败 sample：

```sh
find /tmp/rn-wayang-user-info-manager-scenarios -name '*.jtl' -print0 \
  | xargs -0 rg -n 's="false"|<failure>true'
```

如果命令没有输出，并且 JMeter summary 中 `Err: 0 (0.00%)`，说明当前执行的 active
sampler 通过。禁用的 sampler 不会执行。

失败时同时查看 sample label 和 response body。统一响应中的
`{"ok":true,"value":...}` 只表示请求到达被测端 wrapper；SDK 错误或业务错误仍可能在
`value` 中。

常见失败类型：

- `rc="SDK_ERROR"`：SDK 返回错误。
- `rc="PRECONDITION_FAILED"`：场景没有拿到必要前置数据，例如 contact、group、room、
  thread 或 message id。
- `WebSocket I/O error`：通常是转发服务、被测端连接或超时时间问题。

## ChatManager 场景说明

ChatManager 场景是端到端 SDK 场景，不只是验证 WebSocket 协议。它会真实访问 Agora Chat
服务能力。

当前 ChatManager 场景仍主要使用 JMX 中的 `appKey`、`username`、`password`，并在运行中
发现联系人、群组、聊天室等目标。运行前需要保证：

- `appKey`、`username`、`password` 属于同一个 Agora Chat app。
- 该用户至少有一个联系人。
- 该用户至少加入一个群组。
- app 下至少存在一个可发现的公开聊天室。
- 该用户可以向发现到的联系人、群组和聊天室发送消息。

部分场景依赖可选 Agora Chat 服务：

- `message-reaction.jmx` 依赖 reaction 服务。
- `message-translation.jmx` 依赖 translation 服务。
- `message-thread-management.jmx` 和 `message-target-types.jmx` 中的 thread 部分依赖 chat
  thread 服务。

这些能力未开通时产生的 SDK 错误是真实测试失败，不是 JMeter 解析失败。

## 运行时变量

主要 JMeter properties：

- `url`：默认 `localhost`。
- `port`：默认 `8083`。
- `timeout`：默认 `10000`。
- `fileTimeout`：GroupManager 文件场景使用，默认命令示例为 `60000`。
- `topic`：默认 `rn`。
- `appKey`、`username`、`password`：顶层计划和 ChatManager 场景使用。
- `accountsEnvPath`、`relationshipsEnvPath`：fixture 场景使用。

Shell 环境变量不会被 JMX 自动读取，需要通过 `-J` 映射为 JMeter properties。
在 JMeter UI 中也可以直接编辑 `User Defined Variables`。

其他变量如 `contactUserId`、`conversationId`、`messageId`、`groupId`、`roomId`、
`threadId`、`cursor` 通常由前面的 sampler 在有序运行中发现或覆盖。不要单独运行依赖这些
变量的中间 sampler，除非已经手工准备了对应值。
