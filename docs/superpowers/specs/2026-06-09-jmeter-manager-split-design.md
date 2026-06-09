# JMeter Manager Split Design

## Context

`measured_app` is driven by JMeter through `forward_server`. The current JMeter files under `measured_app/jmeter/data/` are too large for incremental maintenance. Even the small base flow takes hundreds of XML lines, and future SDK coverage would make one combined `.jmx` difficult for both humans and agents to edit safely.

This change defines the first step for splitting JMeter plans by SDK manager. It does not attempt full API coverage.

## Goals

- Create a stable pattern for manager-level JMeter plans.
- Keep each new `.jmx` independently runnable from JMeter UI and CLI.
- Align file naming with `measured_app/src/biz/Biz*.ts` manager boundaries.
- Use `rn-sdk-base.jmx` as the only XML formatting reference.
- Add only a few representative sample cases per file.
- Preserve room for a future merge tool that can combine manager plans into one larger JMeter plan.

## Non-Goals

- Do not cover all `react-native-chat-sdk@1.15.0` APIs in this step.
- Do not migrate cases from `rn-sdk-group.jmx` or `rn-sdk-new-feature.jmx`.
- Do not use `rn-sdk-group.jmx` or `rn-sdk-new-feature.jmx` as structural references; they may be deleted and recreated later.
- Do not implement the future `.jmx` merge tool in this task.
- Do not change measured_app API behavior for the sake of JMeter output.

## Files

Add these initial manager plans:

- `measured_app/jmeter/data/rn-sdk-chat-client.jmx`
- `measured_app/jmeter/data/rn-sdk-chat-manager.jmx`
- `measured_app/jmeter/data/rn-sdk-group-manager.jmx`

Each file contains only a small number of examples. They are templates plus starter coverage, not complete manager test suites.

## Shared Plan Structure

Each manager plan follows this sequence:

1. `建立连接`
2. `初始化`
3. `登录`
4. One or two manager-specific sample requests
5. `登出`

Each plan is independently runnable. The shared setup and teardown are duplicated intentionally for now, but they must stay template-like so a future merge tool can identify and deduplicate shared sections.

## Shared Parameters

The new files inherit the current `rn-sdk-base.jmx` values:

- `url = localhost`
- `port = 8083`
- `topic = rn`
- `appKey = easemob-demo#unitytest`
- `username = tst02`
- `password = 1`

Other common JMeter variables should follow the names and order used by `rn-sdk-base.jmx` unless there is a concrete reason to add a manager-specific value.

## XML Format Rules

Use `measured_app/jmeter/data/rn-sdk-base.jmx` as the only format reference.

The new files should preserve:

- JMeter 5.6.3 plan header style.
- Existing `TestPlan`, `Arguments`, `ThreadGroup`, sampler, and listener structure.
- `RequestResponseWebSocketSampler` property names and ordering.
- Test element and sibling `hashTree` pairing.
- Existing listener style unless debug output requires a deliberate change.

Because `.jmx` is JMeter's serialized object graph, valid XML is not enough. If a component or property is uncertain, verify against a JMeter-generated example or relevant JMeter/plugin documentation before editing.

## Sample Selection

Sample requests should be low risk and easy to reason about.

- `rn-sdk-chat-client.jmx`: one or two `BizChatClient` examples, preferably simple client state or configuration commands.
- `rn-sdk-chat-manager.jmx`: one or two `BizChatManager` examples, preferably simple message or conversation commands with straightforward parameters.
- `rn-sdk-group-manager.jmx`: one or two `BizChatGroupManager` examples, preferably query-style commands. Avoid create/delete lifecycle cases in this first pass.

Commands must be selected from current measured_app support in `Dispatch.ts` and the matching `Biz*` wrapper.

## CLI Execution Notes

JMeter can be run from:

```bash
rm -f <result.jtl> <run.log>
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t <plan.jmx> \
  -l <result.jtl> \
  -j <run.log> \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Before CLI execution, ensure there is no stale JMeter/UI driver connection using the same `topic=rn`. `forward_server` runs in reply mode, where the first connection in a topic is the initiator. A stale UI driver can remain the initiator and receive CLI requests, causing CLI samples to time out.

Delete the target `.jtl` and `.log` before each CLI run, or use a fresh output path, because JMeter appends to existing result files.

## Result And Logging Expectations

JMeter results are used for sampler status, response code, timing, request data, and basic response data.

CLI verification should enable XML result output and only the two payload fields needed for inspection: request data and response data. In this WebSocket sampler, request JSON is saved by JMeter's `samplerData` property and appears under `Request data`; response content is saved by `response_data` and may be JSON or a simple value such as `no return data`, depending on what measured_app sends through the protocol. `output_format=xml` is required for these fields to be visible in the `.jtl` in a useful form.

Detailed SDK behavior should be verified through measured_app JSON logs. JMeter `.log` is primarily for JMeter runtime diagnostics and summary output.

## Verification

For each new manager plan:

1. Confirm the `.jmx` is well-formed XML.
2. Run it with JMeter CLI using `/Applications/apache-jmeter-5.6.3/bin/jmeter`.
3. Inspect the `.jtl` for zero sampler errors.
4. If CLI output is ambiguous, use measured_app JSON logs to confirm actual SDK dispatch.
5. Optionally open the plan in JMeter UI to confirm the visual node tree loads as expected.
