# RN Chat SDK API Alignment Skill Design

## Purpose

Create a project-local Codex skill for repeatedly aligning
`measured_app/src/biz/Biz*.ts` wrappers with the local
`react-native-chat-sdk` TypeScript declarations.

Adding SDK APIs is expected to be a long-running, iterative maintenance task.
The project needs a reusable workflow that can be invoked in later sessions,
not a one-off manual checklist. The skill should make each iteration
repeatable while still preserving human review for wrapper implementation
details.

## Skill Location

The skill is committed with this repository:

```text
.codex/skills/rn-chat-sdk-api-alignment/
  SKILL.md
  scripts/audit-chat-sdk-api-alignment.js
  scripts/collect-protocol-routes.js
  scripts/detect-legacy-alias-candidates.js
  references/biz-wrapper-rules.md
```

This is intentionally project-specific. It can hardcode the current repository
layout, manager list, protocol exceptions, and validation commands. Generalizing
the skill for other projects is out of scope.

## Scope

The skill supports this workflow:

1. audit SDK API alignment;
2. classify missing, deprecated, and possibly renamed wrappers;
3. guide manual or AI-assisted `Biz*` wrapper implementation;
4. rerun the generated dispatch route generator;
5. require human review for wrapper behavior and parameter mapping;
6. run static and smoke verification.

The skill does not automatically implement wrappers.

Wrapper implementation remains handwritten because individual SDK APIs can
require different `info` extraction, field aliases, enum normalization, message
construction, prefetching, callback behavior, or SDK-specific handling.

## Source Of Truth

The SDK source of truth is:

```text
measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/*.d.ts
```

Target APIs are public methods that:

- are declared on one of these SDK classes:
  - `ChatClient`
  - `ChatManager`
  - `ChatGroupManager`
  - `ChatRoomManager`
  - `ChatContactManager`
  - `ChatPresenceManager`
  - `ChatPushManager`
  - `ChatUserInfoManager`
- return `Promise<...>`;
- are not marked with `@deprecated`.

The wrapper source set is:

```text
measured_app/src/biz/Biz*.ts
```

Generated dispatch routes are refreshed by:

```bash
cd measured_app
yarn generate:dispatch
```

## Deprecated API Rule

Deprecated SDK APIs are not part of SDK active coverage.

Do not add missing wrappers for deprecated SDK APIs. Do not add deprecated APIs
to generated SDK route coverage.

Existing deprecated wrappers should be reported for review, but the audit script
must not delete them.

## Login Exception

`ChatClient.login` is deprecated, but the test tool still needs username and
password login for setup flows.

Keep `login` as a protocol/internal setup exception:

- `login` remains routed from `measured_app/src/dispatch/Internal.ts`;
- `login` is not counted as SDK active API coverage;
- `login` is not a precedent for retaining other deprecated SDK APIs;
- token-based login migration is deferred to a separate task.

## Audit Script

Create:

```text
.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
```

The script is read-only. It must not modify source files, generated files, docs,
or package metadata.

The audit command may run producer scripts before the final audit script:

- `collect-protocol-routes.js` reads `measured_app/src/dispatch/Internal.ts`
  and emits protocol/internal route records as JSONL;
- `detect-legacy-alias-candidates.js` reads SDK and Biz method names and emits
  heuristic legacy alias candidates as JSONL. It may also emit wrapper-call
  records when an existing wrapper method name differs from the active SDK
  method it currently calls;
- `audit-chat-sdk-api-alignment.js` reads those JSONL records from stdin and
  produces the final report.

The final audit script keeps built-in protocol helper and legacy alias defaults
only as a fallback for direct execution without `--input`. During normal
`yarn audit:chat-sdk-api` runs, pipeline input is treated as the actual current
project state and overrides those defaults. Empty `--input -` means the current
pipeline produced no records; it must not fall back to built-in defaults.

The script should use the TypeScript compiler API, not fragile line-oriented
regex parsing, to inspect SDK declarations and `Biz*` source files.

Responsibilities:

1. read the configured SDK manager `.d.ts` files;
2. extract active Promise-returning SDK methods;
3. extract deprecated Promise-returning SDK methods;
4. extract static methods from each matching `Biz*` class;
5. report active SDK methods missing same-named `Biz*` wrappers;
6. report deprecated SDK methods that still have same-named wrappers;
7. report the `login` exception separately;
8. report likely legacy or renamed wrappers for human review;
9. report generated dispatch route coverage based on current generated files;
10. exit `0` by default so it can be used as an exploratory report.

The script may support a future `--strict` mode that exits non-zero when active
wrappers are missing, but strict mode is not required for the first version.

## Audit Output

The default report should be grouped for review:

```text
chat sdk api alignment audit

missing active wrappers:
- ChatManager.searchMessages
- ChatManager.searchMessagesInConversation

deprecated wrappers present:
- ChatClient.loginWithAgoraToken
- ChatGroupManager.createGroup

deprecated protocol exceptions:
- ChatClient.login

possible legacy or implementation mismatch wrappers:
- BizChatClient.getCurrentUserName may map to ChatClient.getCurrentUsername (score 1, heuristic)
- BizChatManager.fetchSupportLanguages may map to ChatManager.fetchSupportedLanguages (score 1, wrapper-call)

generated dispatch coverage:
- active wrappers routed: <count>
- active wrappers not routed: <count>
```

The exact counts can vary as wrappers are added.

## Wrapper Implementation Rules

When the skill is used to implement alignment changes:

1. implement wrappers manually in `measured_app/src/biz/Biz*.ts`;
2. use SDK method names for active SDK wrapper names;
3. do not keep old command aliases in generated SDK routes;
4. allow wrapper internals to tolerate existing `info` field aliases when useful;
5. use `BizBase.tryCatch(promise, callback, <sdk-method-name>)`;
6. keep listener/delegate helpers outside generated SDK coverage;
7. rerun `yarn generate:dispatch` after wrapper changes;
8. review generated route diffs before finishing.

Old wrapper names can remain temporarily only when they are internal helpers or
when removal would be handled by a later cleanup task. They should be reported
by the audit script as legacy candidates, not silently accepted as aligned SDK
coverage.

Wrapper-call mismatch records are review inputs, not automatic rename
instructions. They may indicate a legitimate legacy command name or a wrapper
implementation bug.

## Human Review Requirements

Human review is required for wrapper changes where any of these are true:

- the SDK method takes multiple positional parameters;
- the wrapper builds message, group, room, presence, push, or user-info objects;
- the wrapper maps enum-like values;
- the wrapper supports multiple historical `info` field names;
- the SDK method name changed from an existing wrapper command name;
- the SDK return type suggests special callback formatting may be needed.

The skill should prompt the agent to summarize these risky mappings before
claiming completion.

## Validation

Every implementation iteration should run from `measured_app`:

```bash
yarn generate:dispatch
yarn lint
yarn test
```

If a package script is added for the audit script, the preferred validation
sequence becomes:

```bash
yarn audit:chat-sdk-api
yarn generate:dispatch
yarn lint
yarn test
```

JMeter execution is not part of this skill. JMeter validation belongs to later
coverage tasks after wrappers and generated dispatch routes are aligned.

## Non-Goals

- Do not build a generic skill for other repositories.
- Do not auto-generate `Biz*` wrapper implementations.
- Do not migrate the test setup from username/password `login` to token login.
- Do not update JMeter plans as part of the skill creation task.
- Do not remove deprecated wrappers automatically.
- Do not preserve old command aliases in generated SDK routes.

## Completion Criteria

The skill creation task is complete when:

- `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md` exists;
- the read-only audit script exists under the skill directory;
- the skill documents the active API, deprecated API, and `login` exception rules;
- the skill documents the wrapper implementation and human review workflow;
- the audit script can be run against the current repository;
- `yarn generate:dispatch`, `yarn lint`, and `yarn test` pass after any related
  package script changes.
