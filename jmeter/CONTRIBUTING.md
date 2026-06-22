# JMeter 贡献指南

本文档面向维护 `jmeter/` 测试计划和生成器的开发者。运行测试的使用说明见
[README.md](README.md)。

## 目录边界

主要目录：

- `data/*.jmx`：顶层覆盖测试计划。
- `data/chat-manager/*.jmx`：ChatManager 场景测试计划，生成物。
- `data/contact-manager/*.jmx`：ContactManager 场景测试计划，生成物。
- `data/group-manager/*.jmx`：GroupManager 场景测试计划，生成物。
- `data/chat-room-manager/*.jmx`：ChatRoomManager 场景测试计划，生成物。
- `data/user-info-manager/*.jmx`：ChatUserInfoManager 场景测试计划，生成物。
- `tools/*_scenarios/generate.js`：场景 JMX 生成器。
- `tools/*_scenarios/generate.test.js`：生成器测试。
- `data-fixtures/`：Easemob REST fixture 数据准备工具。

## 生成物规则

以下目录下的 `.jmx` 是生成物，不要直接手工编辑：

```text
jmeter/data/chat-manager/
jmeter/data/contact-manager/
jmeter/data/group-manager/
jmeter/data/chat-room-manager/
jmeter/data/user-info-manager/
```

正确修改流程：

1. 修改对应 `jmeter/tools/*_scenarios/generate.js` 或场景定义。
2. 运行对应生成器测试。
3. 运行对应生成器。
4. 检查生成的 `.jmx` diff。
5. 运行受影响的 JMeter 场景。
6. 生成器、测试和生成后的 `.jmx` 一起提交。

## 场景生成命令

ChatManager：

```sh
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
node jmeter/tools/chat_manager_scenarios/generate.js
```

ContactManager：

```sh
node --test jmeter/tools/contact_manager_scenarios/generate.test.js
node jmeter/tools/contact_manager_scenarios/generate.js
```

GroupManager：

```sh
node --test jmeter/tools/group_manager_scenarios/generate.test.js
node jmeter/tools/group_manager_scenarios/generate.js
```

ChatRoomManager：

```sh
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
node jmeter/tools/chat_room_manager_scenarios/generate.js
```

ChatUserInfoManager：

```sh
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
node jmeter/tools/user_info_manager_scenarios/generate.js
```

全部生成器测试：

```sh
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
node --test jmeter/tools/contact_manager_scenarios/generate.test.js
node --test jmeter/tools/group_manager_scenarios/generate.test.js
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

## 顶层 JMX 维护

`jmeter/data/*.jmx` 是顶层覆盖计划，目前不是生成物，可以手工编辑。

维护要求：

- 使用 `-J` property 支持 CLI 覆盖，例如 `url`、`port`、`timeout`、`topic`。
- WebSocket 路径保持 `/iov/websocket/dual?topic=${topic}`。
- 请求 payload 使用当前 `measured_app` 的命令名和 `info` 结构。
- 断言先检查统一协议响应，再检查具体 SDK 或业务结果。
- 如果命令来自 generated dispatch route，命令名使用 manager-qualified 形式，
  例如 `ChatGroupManager.getGroupWithId`。

顶层计划可能包含 disabled sampler。不要仅因为 sampler disabled 就删除它；先确认它是废弃、
被场景用例替代，还是等待服务端能力开通。

## 场景生成器维护

修改生成器时，保持以下原则：

- 生成出的 JMX diff 应该稳定，避免无关排序或格式变化。
- 共享 WebSocket、断言、JSR223 helper 逻辑放在 generator 里。
- 场景业务链路保持有序 Thread Group，不要把 init、login、logout 移到 setUp 或
  tearDown Thread Group，除非所有相关断言和执行顺序都重新验证。
- fixture 场景通过 `accountsEnvPath` 和 `relationshipsEnvPath` 读取状态，不把实际账号、
  group id 或 room id 写死进 `.jmx`。
- runtime 变量如 `messageId`、`groupId`、`roomId`、`cursor` 由前置 sampler 发现或覆盖，
  不保存回生成器输出。

## data-fixtures 维护

`data-fixtures/` 负责准备固定测试账号和关系状态。它不修改 `.jmx`，也不生成 JMeter
properties 文件。

常用命令：

```sh
cd jmeter/data-fixtures
yarn prepare
yarn prepare:accounts
yarn reset:relationships
yarn delete:accounts
yarn test
```

维护要求：

- 不提交 `config.local.cjs`。
- 不提交 `.state/` 下的运行时文件。
- 不把 REST app token 写入日志、`.env` 或 JMX。
- 删除账号只删除 `userPrefix` 派生出的固定账号，不做无范围限制的批量删除。
- 修改账号或关系输出字段后，同步修改依赖这些字段的场景生成器和 README。

## 执行场景前的数据规则

运行以下场景前，通常需要先执行：

```sh
cd jmeter/data-fixtures
yarn prepare:accounts
yarn reset:relationships
```

依赖 fixture 的目录：

- `jmeter/data/contact-manager/`
- `jmeter/data/group-manager/`
- `jmeter/data/chat-room-manager/`
- `jmeter/data/user-info-manager/`

这些场景可能修改服务端状态。重复运行 mutating 场景或批量场景前，重新执行
`reset:relationships`。

ChatManager 场景目前主要使用 JMX 中的 `appKey`、`username`、`password`，并在运行中发现
联系人、群组和聊天室。维护 ChatManager 场景时，要特别确认测试账号环境是否满足 README 中的
前置条件。

## JMeter 执行验证

修改 JMX 或生成器后，至少运行受影响目录中的一个代表场景。示例：

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

检查失败 sample：

```sh
find /tmp/rn-wayang-user-info-manager-scenarios -name '*.jtl' -print0 \
  | xargs -0 rg -n 's="false"|<failure>true'
```

如果有失败，优先查看：

- JMeter sample label。
- response body。
- JMeter log。
- `measured_app` 日志。
- `forward_server` 是否有连接和转发日志。

## 常见失败分类

- `SDK_ERROR`：SDK 或服务端返回错误。通常需要看 `value` 里的 code 和 description。
- `PRECONDITION_FAILED`：场景没拿到必要前置数据，例如 contact、group、room、thread 或
  message id。
- `WebSocket I/O error`：通常是 `forward_server` 未启动、`measured_app` 未连接、topic
  不一致或 timeout 过短。
- 登录失败或“用户已登录”：先确认上一个场景是否正确 logout，再检查被测端是否重启或 SDK
  session 状态是否残留。

## 提交前检查

提交 JMeter 改动前至少确认：

```sh
git diff --check
```

如果改了生成器，运行对应 `node --test ...generate.test.js`。
如果改了生成出的 `.jmx`，说明对应生成命令和实际执行过的 JMeter 场景。
如果改了 `data-fixtures`，运行：

```sh
cd jmeter/data-fixtures
yarn test
```

不要提交：

- `jmeter/data-fixtures/config.local.cjs`
- `jmeter/data-fixtures/.state/`
- JMeter `.jtl`、`.log`、HTML report 输出
- 临时账号、token 或服务端资源 id
