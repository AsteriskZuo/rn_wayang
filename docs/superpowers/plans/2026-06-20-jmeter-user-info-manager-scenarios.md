# JMeter User Info Manager Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build generated JMeter scenario plans for ChatUserInfoManager using the same fixture-driven pattern as the contact, group, and chat room suites.

**Architecture:** Add a focused Node.js generator under `jmeter/tools/user_info_manager_scenarios/` that owns scenario definitions, shared Groovy helpers, fixture loading, XML generation, and writing generated JMX files. The generated plans consume `accounts.env` and `relationships.env`, run a single ordered thread, call the existing measured-app WebSocket commands, and assert user-info values from SDK responses.

**Tech Stack:** Node.js built-in test runner, JMeter 5.6.3 JMX XML, Groovy JSR223 samplers/post-processors, measured-app WebSocket dispatch commands.

---

### Task 1: Generator Contract Tests

**Files:**
- Create: `jmeter/tools/user_info_manager_scenarios/generate.test.js`
- Create: `jmeter/tools/user_info_manager_scenarios/generate.js`

- [ ] **Step 1: Write the failing test**

Create `jmeter/tools/user_info_manager_scenarios/generate.test.js` with tests for:

```js
const expectedFilenames = [
  'user-info-own-query.jmx',
  'user-info-batch-query.jmx',
  'user-info-update-lifecycle.jmx',
];
```

Assert the generator exports `buildAllPlans`, `buildPlan`, `xmlEscape`, and `scenarioDefinitions`; writes exactly those files; preserves unrelated files; validates fixture keys; maps documented variables; contains shared JMeter lifecycle samplers; and includes the three ChatUserInfoManager workflows.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

Expected: fail with `Cannot find module './generate'` or missing exported generator behavior.

- [ ] **Step 3: Write minimal implementation**

Create `jmeter/tools/user_info_manager_scenarios/generate.js` by adapting the existing scenario generator shape. Include:

```js
const defaultOutputDir = path.resolve(__dirname, '../../data/user-info-manager');
const expectedAccountKeys = [
  'APP_KEY',
  'DEFAULT_PASSWORD',
  'PRIMARY_USERNAME',
  'PRIMARY_PASSWORD',
  'CONTACT_FRIEND_USERNAME',
  'CHAT_PEER_USERNAME',
  'GROUP_OWNER_USERNAME',
  'ROOM_OWNER_USERNAME',
];
const expectedRelationshipKeys = [
  'APP_KEY',
  'PRIMARY_USERNAME',
  'CONTACT_FIXTURE_READY',
];
const sharedFixtureKeys = ['APP_KEY', 'PRIMARY_USERNAME'];
```

Implement three scenario definitions and reuse ordinary init, pre-cleanup logout, login, and final logout samplers.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

Expected: all tests pass.

### Task 2: Generate JMX Files

**Files:**
- Create: `jmeter/data/user-info-manager/user-info-own-query.jmx`
- Create: `jmeter/data/user-info-manager/user-info-batch-query.jmx`
- Create: `jmeter/data/user-info-manager/user-info-update-lifecycle.jmx`

- [ ] **Step 1: Run generator**

Run:

```bash
node jmeter/tools/user_info_manager_scenarios/generate.js
```

Expected: it prints three generated file paths under `jmeter/data/user-info-manager/`.

- [ ] **Step 2: Verify generated files**

Run:

```bash
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

Expected: all tests pass and generated XML contains no `undefined` values.

### Task 3: Documentation

**Files:**
- Modify: `jmeter/README.md`

- [ ] **Step 1: Update generation docs**

Add a `ChatUserInfoManager` generation section after `ChatRoomManager`, with:

```bash
node jmeter/tools/user_info_manager_scenarios/generate.js
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

- [ ] **Step 2: Update execution docs**

Add a CLI loop for `jmeter/data/user-info-manager/*.jmx` using `USER_INFO_ACCOUNTS_ENV_PATH` and `USER_INFO_RELATIONSHIPS_ENV_PATH`, and include `/tmp/rn-wayang-user-info-manager-scenarios/*.jtl` in the result-check command.

### Task 4: Verification and Commit

**Files:**
- All files touched above

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test jmeter/tools/user_info_manager_scenarios/generate.test.js
```

Expected: pass.

- [ ] **Step 2: Run existing related generator tests**

Run:

```bash
node --test jmeter/tools/contact_manager_scenarios/generate.test.js
node --test jmeter/tools/group_manager_scenarios/generate.test.js
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
node --test jmeter/data-fixtures/test/*.test.js
```

Expected: pass.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: only the new spec, plan, generator, tests, generated JMX files, and README changes are present.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/superpowers/specs/2026-06-20-jmeter-user-info-manager-scenarios-design.md docs/superpowers/plans/2026-06-20-jmeter-user-info-manager-scenarios.md jmeter/tools/user_info_manager_scenarios jmeter/data/user-info-manager jmeter/README.md
git commit -m "feat: add user info manager jmeter scenarios"
```
