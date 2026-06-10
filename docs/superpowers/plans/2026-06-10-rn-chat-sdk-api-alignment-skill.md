# RN Chat SDK API Alignment Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-local Codex skill that audits `react-native-chat-sdk`
API alignment against handwritten `Biz*` wrappers and guides future iterative
wrapper work.

**Architecture:** Add a repository-managed skill under
`.codex/skills/rn-chat-sdk-api-alignment/`. The skill owns workflow
instructions and a read-only Node.js audit pipeline. Two producer scripts derive
protocol routes and legacy/mismatch candidates, then pipe JSONL records into the
final audit script, which parses SDK declarations, Biz wrappers, and generated
dispatch route files with the TypeScript compiler API. `measured_app/package.json`
gets a convenience script so future workers can run the audit from the app
project.

**Tech Stack:** Codex skills, Node.js, TypeScript compiler API, Yarn 4,
existing React Native Jest and ESLint checks.

---

## Execution Rule

Do not create per-task commits while executing this plan. Complete
implementation and validation first, then report changed files and verification
results so the user can decide whether and how to commit.

## File Structure

- Create `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md`
  - Project-local workflow for SDK/Biz alignment.
  - Triggers on Chat SDK API alignment, missing Biz wrappers, wrapper audits,
    SDK upgrades, and generated dispatch coverage reviews.
- Create `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`
  - Detailed project-specific wrapper rules and review checklist.
  - Documents the audit pipeline inputs and human-review requirements.
- Create `.codex/skills/rn-chat-sdk-api-alignment/scripts/collect-protocol-routes.js`
  - Read-only producer script.
  - Parses `measured_app/src/dispatch/Internal.ts`.
  - Emits protocol/internal route records as JSONL.
- Create `.codex/skills/rn-chat-sdk-api-alignment/scripts/detect-legacy-alias-candidates.js`
  - Read-only producer script.
  - Emits heuristic legacy alias candidates and wrapper-call mismatch candidates
    as JSONL.
- Create `.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js`
  - Read-only final audit script.
  - Parses SDK `.d.ts`, `Biz*` source files, and generated dispatch files.
  - Reads producer JSONL records from stdin when called with `--input -`.
  - Reports missing active wrappers, deprecated wrappers, `login` exception,
    possible legacy or implementation mismatch wrappers, and route coverage.
- Modify `measured_app/package.json`
  - Add an `audit:chat-sdk-api` script that runs both producers, fails if either
    producer fails, and passes their combined output to the final audit script.

## Pipeline Input Rule

The final audit script may keep built-in protocol helper and legacy alias
defaults, but only as fallback values for direct execution without `--input`.
During normal `yarn audit:chat-sdk-api` runs, the producer scripts provide the
actual values through stdin.

Empty `--input -` means the producer pipeline emitted no records and must not
fall back to defaults. This keeps the pipeline deterministic and avoids turning
hardcoded defaults into the long-term maintenance surface.

## Validation Strategy

This task creates project tooling and a Codex skill, not runtime app behavior.
Validation is:

- direct final audit script execution with fallback defaults;
- empty stdin execution with `--input -` to prove defaults are not used;
- producer-to-audit package script execution;
- generated dispatch refresh remains stable;
- ESLint passes;
- Jest smoke test passes;
- skill file metadata and references are readable.

Run from `measured_app`:

```bash
yarn audit:chat-sdk-api
yarn generate:dispatch
yarn lint
yarn test
```

Jest may require elevated permissions because Watchman can be blocked by
sandboxed socket access.

## Task 1: Create Skill Instructions

**Files:**
- Create: `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md`

- [ ] **Step 1: Create the skill directory**

Run from repository root:

```bash
mkdir -p .codex/skills/rn-chat-sdk-api-alignment/scripts .codex/skills/rn-chat-sdk-api-alignment/references
```

Expected: command exits `0`.

- [ ] **Step 2: Write `SKILL.md`**

The skill must document:

- project boundaries for SDK declarations, Biz wrappers, generated dispatch
  routes, and the dispatch generator;
- active SDK coverage rules;
- deprecated API handling;
- `ChatClient.login` as the only deprecated setup exception;
- the audit workflow using `yarn audit:chat-sdk-api`;
- the report sections, including
  `possible legacy or implementation mismatch wrappers`;
- manual wrapper implementation rules;
- human-review requirements for risky parameter and object mappings;
- validation commands.

- [ ] **Step 3: Inspect the skill frontmatter**

Run from repository root:

```bash
sed -n '1,40p' .codex/skills/rn-chat-sdk-api-alignment/SKILL.md
```

Expected:

- frontmatter contains `name: rn-chat-sdk-api-alignment`;
- description mentions API alignment, missing Biz wrappers, SDK declaration
  drift, generated dispatch coverage, and `measured_app/src/biz`.

## Task 2: Add Biz Wrapper Rules Reference

**Files:**
- Create: `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`

- [ ] **Step 1: Write the reference file**

The reference must document:

- covered SDK manager classes;
- Promise-returning, non-deprecated method rule;
- deprecated APIs and the `ChatClient.login` exception;
- SDK method name matching for active wrapper names;
- audit pipeline input semantics;
- wrapper-call mismatch records as review inputs, not automatic rename
  instructions;
- local `BizBase.tryCatch` wrapper pattern;
- human-review checklist;
- validation commands.

- [ ] **Step 2: Confirm the reference is discoverable from `SKILL.md`**

Run from repository root:

```bash
rg "references/biz-wrapper-rules.md" .codex/skills/rn-chat-sdk-api-alignment/SKILL.md
```

Expected: one match.

## Task 3: Add Read-Only Audit Pipeline

**Files:**
- Create: `.codex/skills/rn-chat-sdk-api-alignment/scripts/collect-protocol-routes.js`
- Create: `.codex/skills/rn-chat-sdk-api-alignment/scripts/detect-legacy-alias-candidates.js`
- Create: `.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js`

- [ ] **Step 1: Add `collect-protocol-routes.js`**

Implement a read-only producer script that:

- uses the TypeScript compiler API;
- parses `measured_app/src/dispatch/Internal.ts`;
- extracts protocol/internal routes and the SDK methods they call;
- emits JSONL records shaped like:

```json
{"type":"protocol-route","cmd":"login","sdkMethod":"ChatClient.login","reason":"protocol/internal route in src/dispatch/Internal.ts"}
```

Expected: command exits `0` and writes JSONL to stdout.

- [ ] **Step 2: Add `detect-legacy-alias-candidates.js`**

Implement a read-only producer script that:

- uses the TypeScript compiler API;
- reads SDK declarations and Biz wrapper source files;
- emits `legacy-alias-candidate` JSONL records from heuristic name matching;
- emits `legacy-alias-candidate` JSONL records with source `wrapper-call` when
  an existing wrapper name differs from the active SDK method it calls;
- includes `legacy`, `target`, `score`, and `source` fields.

Expected: command exits `0` and writes JSONL to stdout.

- [ ] **Step 3: Add `audit-chat-sdk-api-alignment.js`**

Implement a read-only final audit script that:

- uses the TypeScript compiler API;
- extracts active Promise-returning SDK methods;
- extracts deprecated Promise-returning SDK methods;
- extracts static `Biz*` wrapper methods;
- extracts generated dispatch routes;
- reads producer JSONL records from stdin only when called with `--input -`;
- uses built-in protocol and legacy defaults only when no `--input` argument is
  present;
- does not use defaults for empty `--input -`;
- reports the `login` exception separately;
- reports `possible legacy or implementation mismatch wrappers` with score and
  source;
- exits `0` by default for exploratory use.

Expected direct fallback run:

```bash
node .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
```

Expected stdin run:

```bash
tmp=${TMPDIR:-/tmp}/chat-sdk-api-audit-$$.jsonl
trap 'rm -f "$tmp"' EXIT HUP INT TERM
node .codex/skills/rn-chat-sdk-api-alignment/scripts/collect-protocol-routes.js > "$tmp" &&
  node .codex/skills/rn-chat-sdk-api-alignment/scripts/detect-legacy-alias-candidates.js >> "$tmp" &&
  node .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js --input - < "$tmp"
```

Both commands should exit `0` and print `chat sdk api alignment audit`.

- [ ] **Step 4: Make scripts executable**

Run from repository root:

```bash
chmod +x .codex/skills/rn-chat-sdk-api-alignment/scripts/*.js
```

Expected: command exits `0`.

## Task 4: Add Package Script

**Files:**
- Modify: `measured_app/package.json`

- [ ] **Step 1: Add `audit:chat-sdk-api`**

Update `measured_app/package.json` so the `scripts` block contains a package
script that runs the two producers and passes their combined output into the
final audit script only if both producers succeed:

```json
"audit:chat-sdk-api": "sh -c 'tmp=${TMPDIR:-/tmp}/chat-sdk-api-audit-$$.jsonl; trap \"rm -f \\\"$tmp\\\"\" EXIT HUP INT TERM; node ../.codex/skills/rn-chat-sdk-api-alignment/scripts/collect-protocol-routes.js > \"$tmp\" && node ../.codex/skills/rn-chat-sdk-api-alignment/scripts/detect-legacy-alias-candidates.js >> \"$tmp\" && node ../.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js --input - < \"$tmp\"'"
```

Keep the rest of `package.json` unchanged.

- [ ] **Step 2: Run the package script**

Run from `measured_app`:

```bash
yarn audit:chat-sdk-api
```

Expected:

- command exits `0`;
- only the final audit report is printed;
- producer JSONL does not leak into the user-facing output.
- producer failures make the package script fail.

## Task 5: Validate Skill Usability

**Files:**
- Inspect:
  - `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md`
  - `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`
  - `.codex/skills/rn-chat-sdk-api-alignment/scripts/*.js`

- [ ] **Step 1: Verify skill files exist**

Run from repository root:

```bash
find .codex/skills/rn-chat-sdk-api-alignment -maxdepth 3 -type f -print | sort
```

Expected output:

```text
.codex/skills/rn-chat-sdk-api-alignment/SKILL.md
.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md
.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
.codex/skills/rn-chat-sdk-api-alignment/scripts/collect-protocol-routes.js
.codex/skills/rn-chat-sdk-api-alignment/scripts/detect-legacy-alias-candidates.js
```

- [ ] **Step 2: Verify project-specific rule coverage**

Run from repository root:

```bash
rg "ChatClient.login|deprecated|active SDK|yarn audit:chat-sdk-api|human review|BizBase.tryCatch|pipeline input|wrapper-call" .codex/skills/rn-chat-sdk-api-alignment
```

Expected:

- matches in `SKILL.md`;
- matches in `references/biz-wrapper-rules.md`;
- `ChatClient.login` appears as a deprecated setup exception;
- pipeline input and wrapper-call mismatch semantics are documented.

- [ ] **Step 3: Verify scripts are read-only by inspection**

Run from repository root:

```bash
rg "writeFile|appendFile|rmSync|unlinkSync|mkdirSync|renameSync|copyFileSync" .codex/skills/rn-chat-sdk-api-alignment/scripts
```

Expected: no matches.

## Task 6: App-Level Verification

**Files:**
- Modify only if verification exposes issues:
  - `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md`
  - `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`
  - `.codex/skills/rn-chat-sdk-api-alignment/scripts/*.js`
  - `measured_app/package.json`

- [ ] **Step 1: Run the audit package script**

Run from `measured_app`:

```bash
yarn audit:chat-sdk-api
```

Expected:

- exits `0`;
- prints active SDK API count;
- prints missing wrappers;
- prints deprecated wrappers;
- prints `ChatClient.login` under deprecated protocol exceptions;
- prints possible legacy or implementation mismatch wrappers;
- prints generated dispatch coverage.

- [ ] **Step 2: Run direct fallback and empty input checks**

Run from repository root:

```bash
node .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
printf '' | node .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js --input -
```

Expected:

- both commands exit `0`;
- direct execution uses fallback defaults;
- empty `--input -` does not use fallback defaults.

- [ ] **Step 3: Run the dispatch generator**

Run from `measured_app`:

```bash
yarn generate:dispatch
```

Expected: exits `0` and generated route files remain stable.

- [ ] **Step 4: Run ESLint**

Run from `measured_app`:

```bash
yarn lint
```

Expected: exits `0`.

- [ ] **Step 5: Run Jest**

Run from `measured_app`:

```bash
yarn test
```

Expected:

- exits `0`;
- `__tests__/App.test.tsx` passes.

If Watchman socket access fails with `Operation not permitted`, rerun the same
command with escalated permissions. Do not change test code for a Watchman
sandbox failure.
