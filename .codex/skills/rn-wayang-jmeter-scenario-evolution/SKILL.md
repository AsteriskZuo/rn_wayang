---
name: rn-wayang-jmeter-scenario-evolution
description: Use in the rn_wayang repository when evolving JMeter scenarios for measured_app API changes, including new or changed APIs, deprecated API replacement, scenario generators, JMX files, fixtures, assertions, extractors, lifecycle flows, or affected scenario verification.
---

# RN Wayang JMeter Scenario Evolution

## Purpose

Use this skill when a `measured_app` API change may require JMeter scenario
changes. Treat API changes as a batch, not as one API equals one scenario.

The skill should preserve human judgment for scenario design while enforcing
project-specific JMeter discipline: classify the change, update the right source
of truth, regenerate JMX when needed, and verify the affected plans.

## Start Here

1. Read `AGENTS.md`.
2. Read only the relevant docs:
   - `jmeter/README.md` for running scenarios and reading results.
   - `jmeter/CONTRIBUTING.md` for generator and fixture rules.
   - `measured_app/CONTRIBUTING.md` when the change depends on generated
     dispatch routes or Biz wrappers.
   - `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md` when the API is not yet
     exposed through Biz wrappers and generated dispatch.
   - `.codex/skills/rn-wayang-e2e-debugging/SKILL.md` when a scenario fails and
     the failure layer is unclear.
3. Check branch and worktree state:

   ```bash
   git status --short --branch
   ```

## Batch Inventory

For every API in the batch, record:

- manager/domain and command name
- whether it is new, changed, deprecated, or a replacement
- required login/session state
- required fixture state, such as account, contact, group, chatroom, message, or
  thread data
- whether it mutates server state
- how the result can be verified
- related existing JMeter scenarios or generators

Do not decide scenario count from API count. Decide from business lifecycle,
state boundary, fixture boundary, and verification boundary.

## Group Before Editing

Group the API batch before editing JMX or generators.

- Same new business topic and lifecycle: prefer one coherent lifecycle scenario.
- Same existing lifecycle: prefer extending the existing scenario.
- Deprecated replacement: keep it as a separate migration decision.
- Search, pagination, filter, or option expansion: usually extend an existing
  query/search scenario.
- Different state pollution or cleanup needs: split scenarios even if APIs share
  a manager.
- Cross-manager but same user-visible lifecycle: a single scenario can be valid
  if setup, action, verification, and cleanup are clearer together.

If grouping is not obvious, present 2-3 options with a recommendation and ask
for human confirmation before editing.

## Scenario Categories

### New Independent Scenario

Use when APIs form a new capability with clear setup, action, assertion, and
cleanup, or when adding them to an existing lifecycle would make it hard to
understand or isolate state pollution.

### Extend Existing Lifecycle

Use when the API is a natural step in an existing scenario, can reuse existing
login/resource setup, and can be verified by existing or adjacent follow-up
queries.

### Deprecated API Migration

Use when a new API replaces an old command or deprecated SDK API. Decide whether
to migrate the old scenario, keep both during a compatibility window, or mark
the old path as legacy coverage. Review command names, parameter mapping, and
response assertions.

### Assertion or Extractor Improvement

Use when the API is already called but validation is too shallow. Do not treat
`{ok:true}` as SDK business success. Assert relevant `value` fields, error code
absence/presence, extracted ids, and observable state.

### Fixture or State Preparation

Use when the scenario needs new accounts, relationships, groups, chatrooms,
messages, or cleanup behavior. Prefer fixture preparation tools over hardcoded
temporary state in JMX.

### Generator or Shared Template Change

Use when multiple scenarios need the same sampler, assertion, extractor,
timeout, login/logout, or cleanup behavior. Change the generator/helper, then
regenerate and review all affected JMX diffs.

## Decision Output

Before implementation, summarize the classification. A compact table is enough:

```text
API/API group | category | recommended scenario action | reason | needs human confirmation
```

If the user has already chosen a category, follow it, but still call out obvious
risks such as state pollution, missing cleanup, deprecated coverage loss, or
weak assertions.

## Editing Rules

- Do not manually patch generated JMX when a generator owns it.
- Update the generator, template, fixture tool, or source JMX according to the
  ownership described in `jmeter/CONTRIBUTING.md`.
- Keep scenario structure easy to inspect: setup, action, verification, cleanup.
- Login/logout lifecycle changes must avoid duplicate login, unverified logout,
  stale SDK session assumptions, and topic/connection mismatches.
- Generated dispatch files in `measured_app/src/dispatch/*.generated.ts` are not
  edited directly. Use Biz wrappers and `yarn generate:dispatch`.
- Keep local secrets, REST tokens, fixture `.state` files, and `/tmp` JMeter
  outputs out of commits.

## Verification

After edits:

1. Regenerate affected JMX files when generators are involved.
2. Review generated diffs for sampler order, command names, `info` payload,
   variables, extractors, assertions, and cleanup.
3. Run the narrow affected scenario first.
4. Inspect the `.jtl` before the `.log`; identify failed sampler labels,
   response bodies, assertion messages, and elapsed/timeout symptoms.
5. Inspect the matching `.log` for WebSocket, JSR223, variable, property, and
   file path errors.
6. If failure classification is unclear, switch to
   `rn-wayang-e2e-debugging`.
7. For shared generator, fixture, login/logout, or assertion changes, expand
   verification to the affected scenario set.

Report what changed, which scenarios were regenerated, which scenarios were run,
and whether failures are scenario defects, environment issues, fixture state, or
measured app/API problems.
