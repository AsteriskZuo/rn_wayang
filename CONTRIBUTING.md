# 贡献指南

本文档说明 `rn_wayang` 的多人协作、分支管理和通用开发流程。各子项目的细节见：

- [measured_app/CONTRIBUTING.md](measured_app/CONTRIBUTING.md)
- [jmeter/CONTRIBUTING.md](jmeter/CONTRIBUTING.md)

`forward_server` 当前比较简单，开发流程遵循本文档和
[forward_server/README.md](forward_server/README.md) 即可。

## 分支模型

推荐使用三层分支模型：

```text
main                 稳定分支，只保存经过验证的版本
dev                  多人日常集成分支
feature/fix/docs/*   具体功能、修复或文档任务分支
```

规则：

- `main` 用作稳定版本分支，不直接承接日常开发。
- `dev` 用作多人协作集成分支。
- 功能、bugfix、文档和测试任务从 `dev` 切出短生命周期分支。
- 任务完成后先合并回 `dev`。
- `dev` 经过一轮完整验证后，再合并到 `main`。

建议分支命名：

- `feature/<short-name>`
- `fix/<short-name>`
- `docs/<short-name>`
- `test/<short-name>`

示例：

```sh
git checkout dev
git pull
git checkout -b fix/user-info-login-lifecycle
```

## 提交流程

1. 从 `dev` 创建任务分支。
2. 修改前先确认工作区状态：

   ```sh
   git status --short --branch
   ```

3. 只修改当前任务需要的文件，不混入无关重构。
4. 涉及生成物时，先修改源文件或生成器，再运行生成脚本。
5. 运行对应子项目验证命令。
6. 检查 diff：

   ```sh
   git diff --check
   git diff --stat
   ```

7. 提交到任务分支。
8. 合并回 `dev` 前说明验证结果。

## 提交信息

推荐使用简短前缀：

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `test:` 测试
- `refactor:` 不改变行为的重构
- `chore:` 工具、依赖、工程维护

示例：

```text
docs: add contribution guides
fix: handle stale websocket close events
test: cover user info update lifecycle
```

## 文档边界

- `README.md`：面向使用者，说明如何运行和排查。
- `CONTRIBUTING.md`：面向开发者，说明如何修改、生成、验证和协作。
- `AGENTS.md`：面向 coding agent，记录仓库事实和修改注意事项。
- `docs/superpowers/`：记录较复杂任务的设计、计划和执行记录。

如果修改会影响使用方式，更新 README。
如果修改会影响维护流程，更新 CONTRIBUTING。
如果修改会影响 agent 判断，例如入口文件、生成物、分支约定，更新 AGENTS。

## 子项目验证入口

`measured_app` 常用验证：

```sh
cd measured_app
yarn test --watchman=false
yarn lint
yarn typecheck
```

涉及 Android 原生代码时：

```sh
cd measured_app/android
./gradlew :app:compileDebugKotlin
```

涉及 iOS 原生代码时：

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

`jmeter` 生成器验证：

```sh
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
node --test jmeter/tools/contact_manager_scenarios/generate.test.js
node --test jmeter/tools/group_manager_scenarios/generate.test.js
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

`jmeter/data-fixtures` 验证：

```sh
cd jmeter/data-fixtures
yarn test
```

实际 JMeter 场景执行依赖转发服务、被测端应用和测试账号状态，运行前阅读
[jmeter/README.md](jmeter/README.md)。

## 生成物原则

本仓库有两类重要生成物：

- `measured_app/src/dispatch/*.generated.ts`
- `jmeter/data/*-manager/*.jmx` 场景测试计划

不要直接手改生成物。正确流程是：

1. 修改源 wrapper、生成器或场景定义。
2. 运行对应生成命令。
3. review 生成物 diff。
4. 运行对应测试。
5. 源文件和生成物一起提交。

## 稳定分支合并

将 `dev` 合并到 `main` 前，至少确认：

- 工作区干净。
- `measured_app` 的 Jest、lint、typecheck 通过。
- 涉及原生代码时，对应 Android/iOS 编译检查通过。
- 涉及 JMeter 生成器时，生成器测试通过。
- 涉及场景数据或 JMX 行为时，记录实际执行过的 JMeter 场景和结果。

`main` 合并完成后不要删除 `dev`。`dev` 是长期集成分支。
