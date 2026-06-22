# Agent Skills

本文档记录本仓库内项目专用 skill 的触发场景。直接点名 skill 名称最稳定；
不点名时，大模型会根据请求意图和关键词判断是否加载对应 skill。

## rn-chat-sdk-api-alignment

用于 `measured_app` 中 `react-native-chat-sdk` API 覆盖、Biz wrapper 和
generated dispatch route 对齐相关任务。

常见触发关键词或意图：

- `react-native-chat-sdk`
- SDK API 对齐、API alignment
- Biz wrapper、`Biz*.ts`
- missing Biz wrapper
- SDK declaration、`.d.ts`
- generated dispatch、dispatch route coverage
- `generate-dispatch`
- `measured_app/src/biz`
- 新增 SDK API、补 wrapper
- SDK 升级
- deprecated wrapper
- API 覆盖

典型请求：

```text
使用 rn-chat-sdk-api-alignment 检查 SDK API 覆盖。
measured_app 新增了几个 SDK API，帮我补 wrapper 和 dispatch。
SDK 升级后检查 generated dispatch route 覆盖是否完整。
这个 BizUserInfoManager 里是不是漏了某个 SDK 方法？
```

## rn-wayang-e2e-debugging

用于排查 `forward_server`、`measured_app` 和 `jmeter` 之间的端到端运行失败，
判断问题属于环境、fixture、JMX、协议、SDK、dispatch、RNWS、Biz wrapper 或 native
runtime 哪一层。

常见触发关键词或意图：

- JMeter 失败、JMX 报错
- WebSocket relay 问题
- `forward_server`
- `measured_app` Android/iOS runtime
- `adb logcat`
- iOS simulator log
- fixture state
- 登录失败、logout 没生效
- already logged in
- `PRECONDITION_FAILED`
- `SDK_ERROR`
- WebSocket I/O error
- timeout
- rn_wayang 端到端失败
- 判断是环境问题还是代码问题

典型请求：

```text
使用 rn-wayang-e2e-debugging 排查这个 JMeter 失败。
user-info-update-lifecycle.jmx 又报 already logged in。
跑 JMeter 超时，看看是转发服务还是被测端问题。
帮我确认这是环境问题、fixture 问题还是 measured_app 代码问题。
```

## rn-wayang-jmeter-scenario-evolution

用于 `measured_app` API 变化后，迭代 JMeter 场景、生成器、fixture、断言、
提取器和生命周期测试。它处理的是一批 API 变更，不假设一个 API 必须对应一个场景。

常见触发关键词或意图：

- JMeter 场景迭代
- 新增 JMeter 用例
- 修改 JMX
- 扩展已有场景
- scenario generator、JMX generator
- fixtures
- assertions
- extractors
- lifecycle flow
- deprecated API 替换测试
- 新增 API 需要补测试
- 一批 API 怎么落到 JMeter 场景
- API 变更批次
- 搜索、分页、过滤测试扩展
- 重新生成 JMX

典型请求：

```text
使用 rn-wayang-jmeter-scenario-evolution 设计这批 API 的 JMeter 场景。
measured_app 新增了一批 API，帮我设计应该怎么补 JMeter 场景。
这个 API 是扩展已有 lifecycle 还是新增 JMX？
帮我给 thread 相关 API 新增 JMeter 测试场景。
旧 API 作废了，新 API 要替换测试用例。
帮我修改 JMeter generator 并重新生成场景。
```
