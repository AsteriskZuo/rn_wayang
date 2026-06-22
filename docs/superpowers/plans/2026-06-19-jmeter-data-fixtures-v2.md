# JMeter Data Fixtures V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent Node.js data fixture package under `jmeter/data-fixtures/` that prepares fixed Easemob REST test accounts and resets contact, group, and chat room relationships.

**Architecture:** The package is a plain JavaScript Node.js sub-project with three command entry points: prepare accounts, delete accounts, and reset relationships. Small modules own config loading, fixture user definitions, env-file IO, logging, REST calls, and command orchestration. Runtime state and logs live under ignored `.state/`, while consumable fixture data is emitted as flat `.env` files.

**Tech Stack:** Node.js 18+ built-ins, CommonJS modules, built-in `fetch`, `node:test`, `node:assert`, Yarn package scripts.

**Commit Strategy:** Do not commit after individual tasks. Stage and commit the complete implementation once, after all tasks and verification pass.

---

## File Structure

Create:

- `jmeter/data-fixtures/package.json` - independent package scripts and test command.
- `jmeter/data-fixtures/.gitignore` - ignores `config.local.cjs` and `.state/`.
- `jmeter/data-fixtures/config.example.cjs` - committed user config template.
- `jmeter/data-fixtures/README.md` - concise usage, config, outputs, and safety notes.
- `jmeter/data-fixtures/src/config.js` - loads and validates fixed `config.local.cjs`.
- `jmeter/data-fixtures/src/fixture-users.js` - fixed role-to-username mapping and env output helpers.
- `jmeter/data-fixtures/src/env-file.js` - deterministic `.env` parse/write helpers.
- `jmeter/data-fixtures/src/logger.js` - timestamped file logger with token-safe output.
- `jmeter/data-fixtures/src/rest-client.js` - Easemob REST API wrapper.
- `jmeter/data-fixtures/src/prepare-accounts.js` - account prepare/delete command implementation.
- `jmeter/data-fixtures/src/reset-relationships.js` - relationship reset command implementation.
- `jmeter/data-fixtures/test/config.test.js`
- `jmeter/data-fixtures/test/fixture-users.test.js`
- `jmeter/data-fixtures/test/env-file.test.js`
- `jmeter/data-fixtures/test/logger.test.js`
- `jmeter/data-fixtures/test/rest-client.test.js`
- `jmeter/data-fixtures/test/prepare-accounts.test.js`
- `jmeter/data-fixtures/test/reset-relationships.test.js`

Modify:

- None outside `jmeter/data-fixtures/`.

Implementation boundary:

- Do not change `.jmx` files.
- Do not change `measured_app/`.
- Do not read or adapt older data-management designs.
- Do not add third-party dependencies unless a task explicitly changes this plan.

---

### Task 1: Scaffold Package and Ignored Runtime Files

**Files:**
- Create: `jmeter/data-fixtures/package.json`
- Create: `jmeter/data-fixtures/.gitignore`
- Create: `jmeter/data-fixtures/config.example.cjs`
- Create: `jmeter/data-fixtures/README.md`

- [ ] **Step 1: Create package manifest**

Create `jmeter/data-fixtures/package.json`:

```json
{
  "name": "wayang-data-fixtures",
  "version": "0.1.0",
  "private": true,
  "description": "Easemob REST data fixtures for rn_wayang tests",
  "license": "UNLICENSED",
  "packageManager": "yarn@4.14.1",
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "prepare:accounts": "node src/prepare-accounts.js prepare",
    "delete:accounts": "node src/prepare-accounts.js delete",
    "reset:relationships": "node src/reset-relationships.js",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create local ignore rules**

Create `jmeter/data-fixtures/.gitignore`:

```gitignore
config.local.cjs
.state/
```

- [ ] **Step 3: Create config template**

Create `jmeter/data-fixtures/config.example.cjs`:

```js
'use strict';

module.exports = {
  restHost: 'http://ngi-a1.easemob.com',
  restOrgName: 'easemob-demo',
  restAppName: 'demo',
  restAppToken: '',

  userPrefix: 'wayang_demo',
  defaultPassword: 'qwerty',
  requestTimeoutMs: 30000,
};
```

- [ ] **Step 4: Create README**

Create `jmeter/data-fixtures/README.md`:

````markdown
# Data Fixtures

This package prepares Easemob REST API data for tests. It only manages fixed
accounts, contact relationships, one group, and one chat room.

It does not adapt JMeter variables, does not change `.jmx` files, and does not
prepare conversation data.

## Setup

Copy the config template and fill in the app token:

```bash
cp config.example.cjs config.local.cjs
```

Required config fields:

- `restHost`
- `restOrgName`
- `restAppName`
- `restAppToken`
- `userPrefix`
- `defaultPassword`

Optional config fields:

- `requestTimeoutMs` defaults to `30000`

`config.local.cjs` is ignored by git.

## Commands

```bash
yarn prepare:accounts
yarn delete:accounts
yarn reset:relationships
yarn test
```

## Outputs

Runtime files are written under `.state/`, which is ignored by git:

```text
.state/accounts.env
.state/relationships.env
.state/logs/
```

The `.env` files contain only key-value fixture data. Execution details and REST
errors are written to timestamped log files.

## Safety

The app token is never written to `.env` outputs or logs. Account deletion
deletes only the fixed 16 usernames derived from `userPrefix`; it does not call
REST batch deletion.
````

- [ ] **Step 5: Run scaffold verification**

Run:

```bash
cd jmeter/data-fixtures && yarn test
```

Expected: command runs and reports no tests or passes with zero failures. If the
package manager complains that install state is missing, run the equivalent
Node command instead:

```bash
cd jmeter/data-fixtures && node --test
```

Expected: exits 0.

---

### Task 2: Config Loader

**Files:**
- Create: `jmeter/data-fixtures/src/config.js`
- Create: `jmeter/data-fixtures/test/config.test.js`

- [ ] **Step 1: Write failing config tests**

Create `jmeter/data-fixtures/test/config.test.js`:

```js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { loadConfig, validateConfig } = require('../src/config');

async function makeTempConfig(contents) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-config-'));
  const file = path.join(dir, 'config.local.cjs');
  await fs.writeFile(file, contents);
  return { dir, file };
}

test('validateConfig returns normalized config with appKey', () => {
  const config = validateConfig({
    restHost: 'http://ngi-a1.easemob.com/',
    restOrgName: 'easemob-demo',
    restAppName: 'demo',
    restAppToken: 'token-value',
    userPrefix: 'wayang_demo',
    defaultPassword: 'qwerty',
    requestTimeoutMs: 10000,
  }, '/tmp/config.local.cjs');

  assert.equal(config.restHost, 'http://ngi-a1.easemob.com');
  assert.equal(config.appKey, 'easemob-demo#zuoyu');
  assert.equal(config.userPrefix, 'wayang_demo');
  assert.equal(config.defaultPassword, 'qwerty');
  assert.equal(config.requestTimeoutMs, 10000);
  assert.equal(config.configPath, '/tmp/config.local.cjs');
});

test('validateConfig defaults requestTimeoutMs', () => {
  const config = validateConfig({
    restHost: 'http://ngi-a1.easemob.com',
    restOrgName: 'easemob-demo',
    restAppName: 'demo',
    restAppToken: 'token-value',
    userPrefix: 'wayang_demo',
    defaultPassword: 'qwerty',
  }, '/tmp/config.local.cjs');

  assert.equal(config.requestTimeoutMs, 30000);
});

test('validateConfig rejects empty app token', () => {
  assert.throws(
    () => validateConfig({
      restHost: 'http://ngi-a1.easemob.com',
      restOrgName: 'easemob-demo',
      restAppName: 'demo',
      restAppToken: '',
      userPrefix: 'wayang_demo',
      defaultPassword: 'qwerty',
    }, '/tmp/config.local.cjs'),
    /Missing required config field: restAppToken/,
  );
});

test('validateConfig rejects invalid userPrefix', () => {
  assert.throws(
    () => validateConfig({
      restHost: 'http://ngi-a1.easemob.com',
      restOrgName: 'easemob-demo',
      restAppName: 'demo',
      restAppToken: 'token-value',
      userPrefix: 'wayang demo',
      defaultPassword: 'qwerty',
    }, '/tmp/config.local.cjs'),
    /Invalid userPrefix/,
  );
});

test('loadConfig loads fixed config.local.cjs path', async () => {
  const { dir } = await makeTempConfig(`
    module.exports = {
      restHost: 'http://ngi-a1.easemob.com',
      restOrgName: 'easemob-demo',
      restAppName: 'demo',
      restAppToken: 'token-value',
      userPrefix: 'wayang_demo',
      defaultPassword: 'qwerty',
    };
  `);

  const config = await loadConfig(dir);

  assert.equal(config.appKey, 'easemob-demo#zuoyu');
  assert.equal(config.configPath, path.join(dir, 'config.local.cjs'));
});

test('loadConfig fails when config.local.cjs is missing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-config-missing-'));

  await assert.rejects(
    () => loadConfig(dir),
    /Missing config.local.cjs/,
  );
});
```

- [ ] **Step 2: Run config tests and verify failure**

Run:

```bash
cd jmeter/data-fixtures && node --test test/config.test.js
```

Expected: FAIL with module not found for `../src/config`.

- [ ] **Step 3: Implement config loader**

Create `jmeter/data-fixtures/src/config.js`:

```js
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const REQUIRED_FIELDS = [
  'restHost',
  'restOrgName',
  'restAppName',
  'restAppToken',
  'userPrefix',
  'defaultPassword',
];

function requireNonEmptyString(rawConfig, fieldName) {
  const value = rawConfig[fieldName];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required config field: ${fieldName}`);
  }
  return value.trim();
}

function validateConfig(rawConfig, configPath) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new Error('Config must export an object');
  }

  for (const fieldName of REQUIRED_FIELDS) {
    requireNonEmptyString(rawConfig, fieldName);
  }

  const restHost = requireNonEmptyString(rawConfig, 'restHost').replace(/\/+$/, '');
  const restOrgName = requireNonEmptyString(rawConfig, 'restOrgName');
  const restAppName = requireNonEmptyString(rawConfig, 'restAppName');
  const restAppToken = requireNonEmptyString(rawConfig, 'restAppToken');
  const userPrefix = requireNonEmptyString(rawConfig, 'userPrefix');
  const defaultPassword = requireNonEmptyString(rawConfig, 'defaultPassword');
  const requestTimeoutMs = rawConfig.requestTimeoutMs === undefined
    ? 30000
    : Number(rawConfig.requestTimeoutMs);

  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(userPrefix)) {
    throw new Error('Invalid userPrefix: use letters, numbers, underscore, or hyphen');
  }

  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('Invalid requestTimeoutMs: use a positive integer');
  }

  return {
    restHost,
    restOrgName,
    restAppName,
    restAppToken,
    userPrefix,
    defaultPassword,
    requestTimeoutMs,
    appKey: `${restOrgName}#${restAppName}`,
    configPath,
  };
}

async function loadConfig(packageDir = path.resolve(__dirname, '..')) {
  const configPath = path.join(packageDir, 'config.local.cjs');

  try {
    await fs.access(configPath);
  } catch (error) {
    throw new Error(`Missing config.local.cjs at ${configPath}. Copy config.example.cjs first.`);
  }

  delete require.cache[require.resolve(configPath)];
  const rawConfig = require(configPath);
  return validateConfig(rawConfig, configPath);
}

module.exports = {
  loadConfig,
  validateConfig,
};
```

- [ ] **Step 4: Run config tests and verify pass**

Run:

```bash
cd jmeter/data-fixtures && node --test test/config.test.js
```

Expected: PASS.

---

### Task 3: Fixture User Definitions

**Files:**
- Create: `jmeter/data-fixtures/src/fixture-users.js`
- Create: `jmeter/data-fixtures/test/fixture-users.test.js`

- [ ] **Step 1: Write failing fixture user tests**

Create `jmeter/data-fixtures/test/fixture-users.test.js`:

```js
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CONTACT_CANDIDATE_KEYS,
  RECIPROCAL_FRIEND_KEYS,
  TARGET_FRIEND_KEYS,
  buildAccountEnv,
  buildFixtureUsers,
  getAllUsernames,
} = require('../src/fixture-users');

test('buildFixtureUsers creates stable 16-account mapping', () => {
  const users = buildFixtureUsers('wayang_demo', 'qwerty');

  assert.equal(users.PRIMARY_USERNAME, 'wayang_demo_001');
  assert.equal(users.CONTACT_FRIEND_USERNAME, 'wayang_demo_002');
  assert.equal(users.CONTACT_NON_FRIEND_USERNAME, 'wayang_demo_003');
  assert.equal(users.CONTACT_EXISTING_FRIEND_USERNAME, 'wayang_demo_004');
  assert.equal(users.CONTACT_FRIEND_TO_ADD_USERNAME, 'wayang_demo_005');
  assert.equal(users.CHAT_PEER_USERNAME, 'wayang_demo_006');
  assert.equal(users.GROUP_OWNER_USERNAME, 'wayang_demo_007');
  assert.equal(users.GROUP_MEMBER_USERNAME_1, 'wayang_demo_008');
  assert.equal(users.GROUP_MEMBER_USERNAME_2, 'wayang_demo_009');
  assert.equal(users.GROUP_NON_MEMBER_USERNAME_1, 'wayang_demo_010');
  assert.equal(users.GROUP_NON_MEMBER_USERNAME_2, 'wayang_demo_011');
  assert.equal(users.ROOM_OWNER_USERNAME, 'wayang_demo_012');
  assert.equal(users.ROOM_MEMBER_USERNAME_1, 'wayang_demo_013');
  assert.equal(users.ROOM_MEMBER_USERNAME_2, 'wayang_demo_014');
  assert.equal(users.ROOM_NON_MEMBER_USERNAME_1, 'wayang_demo_015');
  assert.equal(users.ROOM_NON_MEMBER_USERNAME_2, 'wayang_demo_016');
});

test('getAllUsernames returns exactly 16 unique usernames', () => {
  const users = buildFixtureUsers('wayang_demo', 'qwerty');
  const usernames = getAllUsernames(users);

  assert.equal(usernames.length, 16);
  assert.equal(new Set(usernames).size, 16);
  assert.equal(usernames[0], 'wayang_demo_001');
  assert.equal(usernames[15], 'wayang_demo_016');
});

test('buildAccountEnv creates flat key-value account output', () => {
  const users = buildFixtureUsers('wayang_demo', 'qwerty');
  const env = buildAccountEnv({
    appKey: 'easemob-demo#zuoyu',
    userPrefix: 'wayang_demo',
    defaultPassword: 'qwerty',
    users,
  });

  assert.equal(env.APP_KEY, 'easemob-demo#zuoyu');
  assert.equal(env.USER_PREFIX, 'wayang_demo');
  assert.equal(env.DEFAULT_PASSWORD, 'qwerty');
  assert.equal(env.PRIMARY_USERNAME, 'wayang_demo_001');
  assert.equal(env.PRIMARY_PASSWORD, 'qwerty');
  assert.equal(env.ROOM_NON_MEMBER_USERNAME_2, 'wayang_demo_016');
  assert.equal(Object.hasOwn(env, 'updatedAt'), false);
  assert.equal(Object.hasOwn(env, 'status'), false);
});

test('contact role constants capture reset behavior', () => {
  assert.deepEqual(CONTACT_CANDIDATE_KEYS, [
    'CONTACT_FRIEND_USERNAME',
    'CONTACT_NON_FRIEND_USERNAME',
    'CONTACT_EXISTING_FRIEND_USERNAME',
    'CONTACT_FRIEND_TO_ADD_USERNAME',
  ]);
  assert.deepEqual(TARGET_FRIEND_KEYS, [
    'CONTACT_FRIEND_USERNAME',
    'CONTACT_EXISTING_FRIEND_USERNAME',
  ]);
  assert.deepEqual(RECIPROCAL_FRIEND_KEYS, [
    'CONTACT_FRIEND_USERNAME',
  ]);
});
```

- [ ] **Step 2: Run fixture user tests and verify failure**

Run:

```bash
cd jmeter/data-fixtures && node --test test/fixture-users.test.js
```

Expected: FAIL with module not found for `../src/fixture-users`.

- [ ] **Step 3: Implement fixture user definitions**

Create `jmeter/data-fixtures/src/fixture-users.js`:

```js
'use strict';

const USER_ROLE_KEYS = [
  'PRIMARY_USERNAME',
  'CONTACT_FRIEND_USERNAME',
  'CONTACT_NON_FRIEND_USERNAME',
  'CONTACT_EXISTING_FRIEND_USERNAME',
  'CONTACT_FRIEND_TO_ADD_USERNAME',
  'CHAT_PEER_USERNAME',
  'GROUP_OWNER_USERNAME',
  'GROUP_MEMBER_USERNAME_1',
  'GROUP_MEMBER_USERNAME_2',
  'GROUP_NON_MEMBER_USERNAME_1',
  'GROUP_NON_MEMBER_USERNAME_2',
  'ROOM_OWNER_USERNAME',
  'ROOM_MEMBER_USERNAME_1',
  'ROOM_MEMBER_USERNAME_2',
  'ROOM_NON_MEMBER_USERNAME_1',
  'ROOM_NON_MEMBER_USERNAME_2',
];

const CONTACT_CANDIDATE_KEYS = [
  'CONTACT_FRIEND_USERNAME',
  'CONTACT_NON_FRIEND_USERNAME',
  'CONTACT_EXISTING_FRIEND_USERNAME',
  'CONTACT_FRIEND_TO_ADD_USERNAME',
];

const TARGET_FRIEND_KEYS = [
  'CONTACT_FRIEND_USERNAME',
  'CONTACT_EXISTING_FRIEND_USERNAME',
];

const RECIPROCAL_FRIEND_KEYS = [
  'CONTACT_FRIEND_USERNAME',
];

function buildFixtureUsers(userPrefix, defaultPassword) {
  const users = {};
  USER_ROLE_KEYS.forEach((roleKey, index) => {
    users[roleKey] = `${userPrefix}_${String(index + 1).padStart(3, '0')}`;
  });
  users.PRIMARY_PASSWORD = defaultPassword;
  return users;
}

function getAllUsernames(users) {
  return USER_ROLE_KEYS.map((roleKey) => users[roleKey]);
}

function buildAccountEnv({ appKey, userPrefix, defaultPassword, users }) {
  return {
    APP_KEY: appKey,
    USER_PREFIX: userPrefix,
    DEFAULT_PASSWORD: defaultPassword,
    PRIMARY_USERNAME: users.PRIMARY_USERNAME,
    PRIMARY_PASSWORD: defaultPassword,
    CONTACT_FRIEND_USERNAME: users.CONTACT_FRIEND_USERNAME,
    CONTACT_NON_FRIEND_USERNAME: users.CONTACT_NON_FRIEND_USERNAME,
    CONTACT_EXISTING_FRIEND_USERNAME: users.CONTACT_EXISTING_FRIEND_USERNAME,
    CONTACT_FRIEND_TO_ADD_USERNAME: users.CONTACT_FRIEND_TO_ADD_USERNAME,
    CHAT_PEER_USERNAME: users.CHAT_PEER_USERNAME,
    GROUP_OWNER_USERNAME: users.GROUP_OWNER_USERNAME,
    GROUP_MEMBER_USERNAME_1: users.GROUP_MEMBER_USERNAME_1,
    GROUP_MEMBER_USERNAME_2: users.GROUP_MEMBER_USERNAME_2,
    GROUP_NON_MEMBER_USERNAME_1: users.GROUP_NON_MEMBER_USERNAME_1,
    GROUP_NON_MEMBER_USERNAME_2: users.GROUP_NON_MEMBER_USERNAME_2,
    ROOM_OWNER_USERNAME: users.ROOM_OWNER_USERNAME,
    ROOM_MEMBER_USERNAME_1: users.ROOM_MEMBER_USERNAME_1,
    ROOM_MEMBER_USERNAME_2: users.ROOM_MEMBER_USERNAME_2,
    ROOM_NON_MEMBER_USERNAME_1: users.ROOM_NON_MEMBER_USERNAME_1,
    ROOM_NON_MEMBER_USERNAME_2: users.ROOM_NON_MEMBER_USERNAME_2,
  };
}

module.exports = {
  CONTACT_CANDIDATE_KEYS,
  RECIPROCAL_FRIEND_KEYS,
  TARGET_FRIEND_KEYS,
  USER_ROLE_KEYS,
  buildAccountEnv,
  buildFixtureUsers,
  getAllUsernames,
};
```

- [ ] **Step 4: Run fixture user tests and verify pass**

Run:

```bash
cd jmeter/data-fixtures && node --test test/fixture-users.test.js
```

Expected: PASS.

---

### Task 4: Env File Helpers

**Files:**
- Create: `jmeter/data-fixtures/src/env-file.js`
- Create: `jmeter/data-fixtures/test/env-file.test.js`

- [ ] **Step 1: Write failing env file tests**

Create `jmeter/data-fixtures/test/env-file.test.js`:

```js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { parseEnvFile, serializeEnv, writeEnvFileAtomic } = require('../src/env-file');

test('serializeEnv writes deterministic key-value lines', () => {
  const text = serializeEnv({
    APP_KEY: 'easemob-demo#zuoyu',
    USER_PREFIX: 'wayang_demo',
    DEFAULT_PASSWORD: 'qwerty',
  });

  assert.equal(text, [
    'APP_KEY=easemob-demo#zuoyu',
    'USER_PREFIX=wayang_demo',
    'DEFAULT_PASSWORD=qwerty',
    '',
  ].join('\n'));
});

test('serializeEnv rejects unsafe keys', () => {
  assert.throws(
    () => serializeEnv({ 'BAD-KEY': 'value' }),
    /Invalid env key/,
  );
});

test('parseEnvFile reads comments, blank lines, and values', () => {
  const env = parseEnvFile(`
    # comment
    APP_KEY=easemob-demo#zuoyu

    GROUP_ID=317080531435524
  `);

  assert.deepEqual(env, {
    APP_KEY: 'easemob-demo#zuoyu',
    GROUP_ID: '317080531435524',
  });
});

test('writeEnvFileAtomic creates parent directory and file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-env-'));
  const file = path.join(dir, '.state', 'accounts.env');

  await writeEnvFileAtomic(file, {
    APP_KEY: 'easemob-demo#zuoyu',
    USER_PREFIX: 'wayang_demo',
  });

  const text = await fs.readFile(file, 'utf8');
  assert.equal(text, 'APP_KEY=easemob-demo#zuoyu\nUSER_PREFIX=wayang_demo\n');
});
```

- [ ] **Step 2: Run env file tests and verify failure**

Run:

```bash
cd jmeter/data-fixtures && node --test test/env-file.test.js
```

Expected: FAIL with module not found for `../src/env-file`.

- [ ] **Step 3: Implement env file helpers**

Create `jmeter/data-fixtures/src/env-file.js`:

```js
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function serializeEnv(env) {
  const lines = [];
  for (const [key, value] of Object.entries(env)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env key: ${key}`);
    }
    const stringValue = String(value);
    if (/[\r\n]/.test(stringValue)) {
      throw new Error(`Invalid env value for ${key}: newlines are not allowed`);
    }
    lines.push(`${key}=${stringValue}`);
  }
  return `${lines.join('\n')}\n`;
}

function parseEnvFile(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      throw new Error(`Invalid env line: ${rawLine}`);
    }
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env key: ${key}`);
    }
    env[key] = value;
  }
  return env;
}

async function readEnvFileIfExists(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return parseEnvFile(text);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeEnvFileAtomic(filePath, env) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, serializeEnv(env), 'utf8');
  await fs.rename(tempPath, filePath);
}

module.exports = {
  parseEnvFile,
  readEnvFileIfExists,
  serializeEnv,
  writeEnvFileAtomic,
};
```

- [ ] **Step 4: Run env file tests and verify pass**

Run:

```bash
cd jmeter/data-fixtures && node --test test/env-file.test.js
```

Expected: PASS.

---

### Task 5: File Logger

**Files:**
- Create: `jmeter/data-fixtures/src/logger.js`
- Create: `jmeter/data-fixtures/test/logger.test.js`

- [ ] **Step 1: Write failing logger tests**

Create `jmeter/data-fixtures/test/logger.test.js`:

```js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createLogger, redactToken, timestampForFile } = require('../src/logger');

test('redactToken removes configured token from log details', () => {
  const text = redactToken('Authorization: Bearer secret-token', 'secret-token');
  assert.equal(text, 'Authorization: Bearer [REDACTED]');
});

test('timestampForFile creates sortable timestamp', () => {
  const timestamp = timestampForFile(new Date('2026-06-19T07:08:09Z'));
  assert.match(timestamp, /^20260619-\d{6}-\d{3}$/);
});

test('createLogger writes timestamped log file with redaction', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-logger-'));
  const logger = await createLogger({
    stateDir: path.join(dir, '.state'),
    commandName: 'prepare-accounts',
    token: 'secret-token',
    now: () => new Date('2026-06-19T07:08:09Z'),
  });

  logger.info('loaded token secret-token');
  logger.error('request failed', { path: '/users/user1', authorization: 'Bearer secret-token' });
  await logger.close();

  assert.match(path.basename(logger.logPath), /^prepare-accounts-20260619-070809-000-pid\d+\.log$/);
  const text = await fs.readFile(logger.logPath, 'utf8');
  assert.match(text, /INFO loaded token \[REDACTED\]/);
  assert.match(text, /ERROR request failed/);
  assert.match(text, /"authorization":"Bearer \[REDACTED\]"/);
});

test('createLogger avoids overwriting same-second log files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-logger-collision-'));
  const options = {
    stateDir: path.join(dir, '.state'),
    commandName: 'reset-relationships',
    token: 'secret-token',
    now: () => new Date('2026-06-19T07:08:09.123Z'),
  };
  const first = await createLogger(options);
  first.info('first');
  await first.close();

  const second = await createLogger(options);
  second.info('second');
  await second.close();

  assert.notEqual(first.logPath, second.logPath);
  assert.match(path.basename(second.logPath), /^reset-relationships-20260619-070809-123-pid\d+-1\.log$/);
  assert.match(await fs.readFile(first.logPath, 'utf8'), /first/);
  assert.match(await fs.readFile(second.logPath, 'utf8'), /second/);
});
```

- [ ] **Step 2: Run logger tests and verify failure**

Run:

```bash
cd jmeter/data-fixtures && node --test test/logger.test.js
```

Expected: FAIL with module not found for `../src/logger`.

- [ ] **Step 3: Implement logger**

Create `jmeter/data-fixtures/src/logger.js`:

```js
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function pad(number) {
  return String(number).padStart(2, '0');
}

function timestampForFile(date = new Date()) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    '-',
    String(date.getUTCMilliseconds()).padStart(3, '0'),
  ].join('');
}

function redactToken(value, token) {
  if (!token) {
    return String(value);
  }
  return String(value).split(token).join('[REDACTED]');
}

function redactDetails(details, token) {
  return JSON.parse(redactToken(JSON.stringify(details), token));
}

async function createLogger({ stateDir, commandName, token, now = () => new Date() }) {
  const logsDir = path.join(stateDir, 'logs');
  await fs.mkdir(logsDir, { recursive: true });
  const baseName = `${commandName}-${timestampForFile(now())}-pid${process.pid}`;
  let logPath = path.join(logsDir, `${baseName}.log`);
  for (let index = 1; ; index += 1) {
    try {
      const handle = await fs.open(logPath, 'wx');
      await handle.close();
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      logPath = path.join(logsDir, `${baseName}-${index}.log`);
    }
  }
  const lines = [];

  function write(level, message, details) {
    const safeMessage = redactToken(message, token);
    const suffix = details === undefined ? '' : ` ${JSON.stringify(redactDetails(details, token))}`;
    lines.push(`${new Date().toISOString()} ${level} ${safeMessage}${suffix}`);
  }

  return {
    logPath,
    info(message, details) {
      write('INFO', message, details);
    },
    error(message, details) {
      write('ERROR', message, details);
    },
    async close() {
      await fs.writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');
    },
  };
}

module.exports = {
  createLogger,
  redactToken,
  timestampForFile,
};
```

- [ ] **Step 4: Run logger tests and verify pass**

Run:

```bash
cd jmeter/data-fixtures && node --test test/logger.test.js
```

Expected: PASS.

---

### Task 6: REST Client

**Files:**
- Create: `jmeter/data-fixtures/src/rest-client.js`
- Create: `jmeter/data-fixtures/test/rest-client.test.js`

- [ ] **Step 1: Write failing REST client tests**

Create `jmeter/data-fixtures/test/rest-client.test.js`:

```js
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { EasemobRestClient, RestError, isMissingResourceError } = require('../src/rest-client');

function makeClient(fetchImpl, logger = { info() {}, error() {} }) {
  return new EasemobRestClient({
    restHost: 'http://ngi-a1.easemob.com',
    restOrgName: 'easemob-demo',
    restAppName: 'demo',
    restAppToken: 'token-value',
    requestTimeoutMs: 30000,
    fetchImpl,
    logger,
  });
}

test('registerUsers posts array body to /users', async () => {
  const calls = [];
  const client = makeClient(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ entities: [{ username: 'user1' }] }),
    };
  });

  const result = await client.registerUsers([{ username: 'user1', password: 'qwerty' }]);

  assert.deepEqual(result, { entities: [{ username: 'user1' }] });
  assert.equal(calls[0].url, 'http://ngi-a1.easemob.com/easemob-demo/demo/users');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-value');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].options.body, '[{"username":"user1","password":"qwerty"}]');
  assert.equal(calls[0].options.signal instanceof AbortSignal, true);
});

test('request throws RestError for non-ok response', async () => {
  const client = makeClient(async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      error: 'duplicate_unique_property_exists',
      exception: 'DuplicateUniquePropertyExistsException',
    }),
  }));

  await assert.rejects(
    () => client.registerUsers([{ username: 'user1', password: 'qwerty' }]),
    (error) => {
      assert.equal(error instanceof RestError, true);
      assert.equal(error.status, 400);
      assert.equal(error.path, '/users');
      assert.equal(error.body.error, 'duplicate_unique_property_exists');
      return true;
    },
  );
});

test('helper methods use validated REST paths', async () => {
  const calls = [];
  const client = makeClient(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { groupid: 'group1', id: 'room1' }, entities: [] }),
    };
  });

  await client.getUser('user1');
  await client.resetPassword('user1', 'qwerty');
  await client.deleteUser('user1');
  await client.addFriend('owner', 'friend');
  await client.deleteFriend('owner', 'friend');
  await client.createGroup({ name: 'g', description: 'd', owner: 'owner', members: ['m1'] });
  await client.deleteGroup('group1');
  await client.createChatRoom({ name: 'r', description: 'd', owner: 'owner', members: ['m1'] });
  await client.deleteChatRoom('room1');

  assert.deepEqual(calls.map((call) => `${call.options.method} ${new URL(call.url).pathname}${new URL(call.url).search}`), [
    'GET /easemob-demo/demo/users/user1',
    'PUT /easemob-demo/demo/users/user1/password',
    'DELETE /easemob-demo/demo/users/user1',
    'POST /easemob-demo/demo/users/owner/contacts/users/friend',
    'DELETE /easemob-demo/demo/users/owner/contacts/users/friend',
    'POST /easemob-demo/demo/chatgroups',
    'DELETE /easemob-demo/demo/chatgroups/group1',
    'POST /easemob-demo/demo/chatrooms',
    'DELETE /easemob-demo/demo/chatrooms/room1',
  ]);
});

test('isMissingResourceError recognizes missing resource errors', () => {
  assert.equal(isMissingResourceError(new RestError({ method: 'GET', path: '/x', status: 404, body: {} })), true);
  assert.equal(isMissingResourceError(new RestError({ method: 'GET', path: '/x', status: 400, body: { error: 'service_resource_not_found' } })), true);
  assert.equal(isMissingResourceError(new Error('nope')), false);
});

test('request wraps network failures with method and path context', async () => {
  const loggerEntries = [];
  const client = makeClient(async () => {
    throw new Error('socket hang up');
  }, {
    info() {},
    error(message, details) {
      loggerEntries.push({ message, details });
    },
  });

  await assert.rejects(
    () => client.getUser('user1'),
    (error) => {
      assert.equal(error.name, 'NetworkRestError');
      assert.equal(error.method, 'GET');
      assert.equal(error.path, '/users/user1');
      assert.equal(error.status, undefined);
      assert.match(error.message, /socket hang up/);
      return true;
    },
  );
  assert.equal(loggerEntries[0].details.path, '/users/user1');
  assert.equal(loggerEntries[0].details.errorName, 'Error');
});
```

- [ ] **Step 2: Run REST client tests and verify failure**

Run:

```bash
cd jmeter/data-fixtures && node --test test/rest-client.test.js
```

Expected: FAIL with module not found for `../src/rest-client`.

- [ ] **Step 3: Implement REST client**

Create `jmeter/data-fixtures/src/rest-client.js`:

```js
'use strict';

class RestError extends Error {
  constructor({ method, path, status, body }) {
    const errorText = body && (body.error || body.exception || body.error_description);
    super(`${method} ${path} failed with HTTP ${status}${errorText ? `: ${errorText}` : ''}`);
    this.name = 'RestError';
    this.method = method;
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

class NetworkRestError extends Error {
  constructor({ method, path, cause }) {
    super(`${method} ${path} failed before HTTP response: ${cause.message}`);
    this.name = 'NetworkRestError';
    this.method = method;
    this.path = path;
    this.cause = cause;
  }
}

function encodePath(value) {
  return encodeURIComponent(value);
}

function isMissingResourceError(error) {
  if (!(error instanceof RestError)) {
    return false;
  }
  const bodyText = JSON.stringify(error.body || {}).toLowerCase();
  return error.status === 404 || bodyText.includes('not_found') || bodyText.includes('not found');
}

function isDuplicateUserError(error) {
  if (!(error instanceof RestError)) {
    return false;
  }
  const bodyText = JSON.stringify(error.body || {}).toLowerCase();
  return error.status === 400 && (
    bodyText.includes('duplicate_unique_property_exists') ||
    bodyText.includes('duplicateuniquepropertyexistsexception')
  );
}

class EasemobRestClient {
  constructor({ restHost, restOrgName, restAppName, restAppToken, requestTimeoutMs = 30000, fetchImpl = fetch, logger }) {
    this.baseUrl = `${restHost}/${encodePath(restOrgName)}/${encodePath(restAppName)}`;
    this.restAppToken = restAppToken;
    this.requestTimeoutMs = requestTimeoutMs;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
  }

  async request(method, path, body) {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.restAppToken}`,
    };
    const options = {
      method,
      headers,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    this.logger?.info?.(`REST ${method} ${path}`);
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, options);
    } catch (cause) {
      const error = new NetworkRestError({ method, path, cause });
      this.logger?.error?.('REST request failed before HTTP response', {
        method,
        path,
        errorName: cause.name,
        errorMessage: cause.message,
      });
      throw error;
    }
    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new RestError({ method, path, status: response.status, body: responseBody });
      this.logger?.error?.('REST request failed', {
        method,
        path,
        status: response.status,
        error: responseBody.error,
        exception: responseBody.exception,
        error_description: responseBody.error_description,
      });
      throw error;
    }

    return responseBody;
  }

  registerUsers(users) {
    return this.request('POST', '/users', users);
  }

  getUser(username) {
    return this.request('GET', `/users/${encodePath(username)}`);
  }

  resetPassword(username, password) {
    return this.request('PUT', `/users/${encodePath(username)}/password`, { newpassword: password });
  }

  deleteUser(username) {
    return this.request('DELETE', `/users/${encodePath(username)}`);
  }

  addFriend(ownerUsername, friendUsername) {
    return this.request(
      'POST',
      `/users/${encodePath(ownerUsername)}/contacts/users/${encodePath(friendUsername)}`,
    );
  }

  deleteFriend(ownerUsername, friendUsername) {
    return this.request(
      'DELETE',
      `/users/${encodePath(ownerUsername)}/contacts/users/${encodePath(friendUsername)}`,
    );
  }

  createGroup({ name, description, owner, members }) {
    return this.request('POST', '/chatgroups', {
      groupname: name,
      description,
      public: true,
      maxusers: 300,
      owner,
      members,
    });
  }

  deleteGroup(groupId) {
    return this.request('DELETE', `/chatgroups/${encodePath(groupId)}`);
  }

  createChatRoom({ name, description, owner, members }) {
    return this.request('POST', '/chatrooms', {
      name,
      description,
      maxusers: 300,
      owner,
      members,
    });
  }

  deleteChatRoom(roomId) {
    return this.request('DELETE', `/chatrooms/${encodePath(roomId)}`);
  }
}

module.exports = {
  EasemobRestClient,
  NetworkRestError,
  RestError,
  isDuplicateUserError,
  isMissingResourceError,
};
```

- [ ] **Step 4: Run REST client tests and verify pass**

Run:

```bash
cd jmeter/data-fixtures && node --test test/rest-client.test.js
```

Expected: PASS.

---

### Task 7: Account Prepare and Delete Command

**Files:**
- Create: `jmeter/data-fixtures/src/prepare-accounts.js`
- Create: `jmeter/data-fixtures/test/prepare-accounts.test.js`

- [ ] **Step 1: Write failing account command tests**

Create `jmeter/data-fixtures/test/prepare-accounts.test.js`:

```js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { RestError } = require('../src/rest-client');
const {
  deleteAccounts,
  prepareAccounts,
} = require('../src/prepare-accounts');

function makeConfig(dir) {
  return {
    restHost: 'http://ngi-a1.easemob.com',
    restOrgName: 'easemob-demo',
    restAppName: 'demo',
    restAppToken: 'token-value',
    userPrefix: 'wayang_demo',
    defaultPassword: 'qwerty',
    appKey: 'easemob-demo#zuoyu',
    configPath: path.join(dir, 'config.local.cjs'),
  };
}

function makeLogger() {
  return {
    logPath: '/tmp/test.log',
    entries: [],
    info(message, details) {
      this.entries.push({ level: 'info', message, details });
    },
    error(message, details) {
      this.entries.push({ level: 'error', message, details });
    },
    async close() {},
  };
}

test('prepareAccounts creates missing accounts and writes accounts.env', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-prepare-'));
  const calls = [];
  const client = {
    async registerUsers(users) {
      calls.push({ method: 'registerUsers', users });
      return { entities: users };
    },
    async getUser(username) {
      calls.push({ method: 'getUser', username });
      return { count: 1, entities: [{ username }] };
    },
    async resetPassword(username, password) {
      calls.push({ method: 'resetPassword', username, password });
      return {};
    },
  };

  const result = await prepareAccounts({
    config: makeConfig(dir),
    client,
    logger: makeLogger(),
    stateDir: path.join(dir, '.state'),
  });

  assert.equal(result.accountsPath, path.join(dir, '.state', 'accounts.env'));
  assert.equal(calls.filter((call) => call.method === 'registerUsers').length, 16);
  assert.equal(calls.filter((call) => call.method === 'resetPassword').length, 0);

  const envText = await fs.readFile(result.accountsPath, 'utf8');
  assert.match(envText, /PRIMARY_USERNAME=wayang_demo_001/);
  assert.match(envText, /ROOM_NON_MEMBER_USERNAME_2=wayang_demo_016/);
  assert.doesNotMatch(envText, /status=/);
});

test('prepareAccounts repairs duplicate existing account by resetting password', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-prepare-dup-'));
  const calls = [];
  const client = {
    async registerUsers(users) {
      calls.push({ method: 'registerUsers', username: users[0].username });
      throw new RestError({
        method: 'POST',
        path: '/users',
        status: 400,
        body: { error: 'duplicate_unique_property_exists' },
      });
    },
    async getUser(username) {
      calls.push({ method: 'getUser', username });
      return { count: 1, entities: [{ username }] };
    },
    async resetPassword(username, password) {
      calls.push({ method: 'resetPassword', username, password });
      return {};
    },
  };

  await prepareAccounts({
    config: makeConfig(dir),
    client,
    logger: makeLogger(),
    stateDir: path.join(dir, '.state'),
  });

  assert.equal(calls.filter((call) => call.method === 'getUser').length, 16);
  assert.equal(calls.filter((call) => call.method === 'resetPassword').length, 16);
  assert.equal(calls.find((call) => call.method === 'resetPassword').password, 'qwerty');
});

test('deleteAccounts cleans previous relationships, deletes users, and removes env files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-delete-'));
  const stateDir = path.join(dir, '.state');
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(path.join(stateDir, 'accounts.env'), 'PRIMARY_USERNAME=wayang_demo_001\n');
  await fs.writeFile(path.join(stateDir, 'relationships.env'), 'GROUP_ID=old-group\nROOM_ID=old-room\n');
  const deleted = [];
  const cleaned = [];
  const client = {
    async deleteGroup(groupId) {
      cleaned.push({ type: 'group', id: groupId });
      return {};
    },
    async deleteChatRoom(roomId) {
      cleaned.push({ type: 'room', id: roomId });
      return {};
    },
    async deleteUser(username) {
      deleted.push(username);
      return {};
    },
  };

  await deleteAccounts({
    config: makeConfig(dir),
    client,
    logger: makeLogger(),
    stateDir,
  });

  assert.deepEqual(cleaned, [
    { type: 'group', id: 'old-group' },
    { type: 'room', id: 'old-room' },
  ]);
  assert.equal(deleted.length, 16);
  await assert.rejects(
    () => fs.access(path.join(stateDir, 'accounts.env')),
    /ENOENT/,
  );
  await assert.rejects(
    () => fs.access(path.join(stateDir, 'relationships.env')),
    /ENOENT/,
  );
});

test('deleteAccounts ignores missing users', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-delete-missing-'));
  const client = {
    async deleteUser() {
      throw new RestError({
        method: 'DELETE',
        path: '/users/missing',
        status: 404,
        body: {},
      });
    },
  };

  await deleteAccounts({
    config: makeConfig(dir),
    client,
    logger: makeLogger(),
    stateDir: path.join(dir, '.state'),
  });
});
```

- [ ] **Step 2: Run account command tests and verify failure**

Run:

```bash
cd jmeter/data-fixtures && node --test test/prepare-accounts.test.js
```

Expected: FAIL with module not found for `../src/prepare-accounts`.

- [ ] **Step 3: Implement account command module**

Create `jmeter/data-fixtures/src/prepare-accounts.js`:

```js
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const { loadConfig } = require('./config');
const { buildAccountEnv, buildFixtureUsers, getAllUsernames } = require('./fixture-users');
const { readEnvFileIfExists, writeEnvFileAtomic } = require('./env-file');
const { createLogger } = require('./logger');
const { EasemobRestClient, isDuplicateUserError, isMissingResourceError } = require('./rest-client');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(PACKAGE_DIR, '.state');

async function prepareAccounts({ config, client, logger, stateDir = DEFAULT_STATE_DIR }) {
  const users = buildFixtureUsers(config.userPrefix, config.defaultPassword);
  const usernames = getAllUsernames(users);

  logger.info('Preparing fixture accounts', { count: usernames.length });

  for (const username of usernames) {
    try {
      logger.info('Registering account', { username });
      await client.registerUsers([{ username, password: config.defaultPassword }]);
    } catch (error) {
      if (!isDuplicateUserError(error)) {
        throw error;
      }
      logger.info('Account exists; resetting password', { username });
      await client.getUser(username);
      await client.resetPassword(username, config.defaultPassword);
    }
  }

  const accountsPath = path.join(stateDir, 'accounts.env');
  await writeEnvFileAtomic(accountsPath, buildAccountEnv({
    appKey: config.appKey,
    userPrefix: config.userPrefix,
    defaultPassword: config.defaultPassword,
    users,
  }));

  logger.info('Wrote account fixture data', { accountsPath });
  return { accountsPath };
}

async function deleteAccounts({ config, client, logger, stateDir = DEFAULT_STATE_DIR }) {
  const users = buildFixtureUsers(config.userPrefix, config.defaultPassword);
  const usernames = getAllUsernames(users);
  const relationshipsPath = path.join(stateDir, 'relationships.env');
  const previousRelationships = await readEnvFileIfExists(relationshipsPath);

  logger.info('Deleting fixture accounts', { count: usernames.length });

  if (previousRelationships.GROUP_ID) {
    try {
      logger.info('Deleting previous group before account cleanup', { groupId: previousRelationships.GROUP_ID });
      await client.deleteGroup(previousRelationships.GROUP_ID);
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw error;
      }
      logger.info('Previous group already missing', { groupId: previousRelationships.GROUP_ID });
    }
  }

  if (previousRelationships.ROOM_ID) {
    try {
      logger.info('Deleting previous chat room before account cleanup', { roomId: previousRelationships.ROOM_ID });
      await client.deleteChatRoom(previousRelationships.ROOM_ID);
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw error;
      }
      logger.info('Previous chat room already missing', { roomId: previousRelationships.ROOM_ID });
    }
  }

  for (const username of usernames) {
    try {
      logger.info('Deleting account', { username });
      await client.deleteUser(username);
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw error;
      }
      logger.info('Account already missing', { username });
    }
  }

  const accountsPath = path.join(stateDir, 'accounts.env');
  await fs.rm(accountsPath, { force: true });
  await fs.rm(relationshipsPath, { force: true });
  logger.info('Removed account fixture data', { accountsPath });
  logger.info('Removed relationship fixture data', { relationshipsPath });
  return { accountsPath };
}

async function runCli() {
  const mode = process.argv[2];
  if (!['prepare', 'delete'].includes(mode)) {
    console.error('Usage: node src/prepare-accounts.js <prepare|delete>');
    process.exitCode = 1;
    return;
  }

  let logger;
  try {
    const config = await loadConfig(PACKAGE_DIR);
    logger = await createLogger({
      stateDir: DEFAULT_STATE_DIR,
      commandName: mode === 'prepare' ? 'prepare-accounts' : 'delete-accounts',
      token: config.restAppToken,
    });
    logger.info('Loaded config', { configPath: config.configPath });
    const client = new EasemobRestClient({ ...config, logger });
    const result = mode === 'prepare'
      ? await prepareAccounts({ config, client, logger })
      : await deleteAccounts({ config, client, logger });
    await logger.close();

    console.log(`${mode === 'prepare' ? 'Prepared' : 'Deleted'} fixture accounts`);
    console.log(`Data file: ${result.accountsPath}`);
    console.log(`Log file: ${logger.logPath}`);
  } catch (error) {
    if (logger) {
      logger.error('Command failed', {
        message: error.message,
        method: error.method,
        path: error.path,
        status: error.status,
        error: error.body?.error,
        exception: error.body?.exception,
        error_description: error.body?.error_description,
      });
      await logger.close();
      console.error(`Command failed. Log file: ${logger.logPath}`);
    } else {
      console.error(`Command failed: ${error.message}`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  deleteAccounts,
  prepareAccounts,
};
```

- [ ] **Step 4: Run account command tests and verify pass**

Run:

```bash
cd jmeter/data-fixtures && node --test test/prepare-accounts.test.js
```

Expected: PASS.

---

### Task 8: Relationship Reset Command

**Files:**
- Create: `jmeter/data-fixtures/src/reset-relationships.js`
- Create: `jmeter/data-fixtures/test/reset-relationships.test.js`

- [ ] **Step 1: Write failing relationship reset tests**

Create `jmeter/data-fixtures/test/reset-relationships.test.js`:

```js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { RestError } = require('../src/rest-client');
const { resetRelationships } = require('../src/reset-relationships');

function makeConfig(dir) {
  return {
    restHost: 'http://ngi-a1.easemob.com',
    restOrgName: 'easemob-demo',
    restAppName: 'demo',
    restAppToken: 'token-value',
    userPrefix: 'wayang_demo',
    defaultPassword: 'qwerty',
    appKey: 'easemob-demo#zuoyu',
    configPath: path.join(dir, 'config.local.cjs'),
  };
}

function makeLogger() {
  return {
    logPath: '/tmp/test.log',
    entries: [],
    info(message, details) {
      this.entries.push({ level: 'info', message, details });
    },
    error(message, details) {
      this.entries.push({ level: 'error', message, details });
    },
    async close() {},
  };
}

test('resetRelationships validates accounts, recreates relationships, and writes env', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-reset-'));
  const stateDir = path.join(dir, '.state');
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(path.join(stateDir, 'relationships.env'), 'GROUP_ID=old-group\nROOM_ID=old-room\n');
  const calls = [];
  const client = {
    async getUser(username) {
      calls.push({ method: 'getUser', username });
      return { count: 1, entities: [{ username }] };
    },
    async deleteGroup(groupId) {
      calls.push({ method: 'deleteGroup', groupId });
      return {};
    },
    async deleteChatRoom(roomId) {
      calls.push({ method: 'deleteChatRoom', roomId });
      return {};
    },
    async deleteFriend(owner, friend) {
      calls.push({ method: 'deleteFriend', owner, friend });
      return {};
    },
    async addFriend(owner, friend) {
      calls.push({ method: 'addFriend', owner, friend });
      return {};
    },
    async createGroup(payload) {
      calls.push({ method: 'createGroup', payload });
      return { data: { groupid: 'new-group' } };
    },
    async createChatRoom(payload) {
      calls.push({ method: 'createChatRoom', payload });
      return { data: { id: 'new-room' } };
    },
  };

  const result = await resetRelationships({
    config: makeConfig(dir),
    client,
    logger: makeLogger(),
    stateDir,
  });

  assert.equal(result.relationshipsPath, path.join(stateDir, 'relationships.env'));
  assert.equal(result.groupId, 'new-group');
  assert.equal(result.roomId, 'new-room');
  assert.equal(calls.filter((call) => call.method === 'getUser').length, 16);
  assert.deepEqual(calls.find((call) => call.method === 'deleteGroup'), { method: 'deleteGroup', groupId: 'old-group' });
  assert.deepEqual(calls.find((call) => call.method === 'deleteChatRoom'), { method: 'deleteChatRoom', roomId: 'old-room' });
  assert.deepEqual(
    calls.filter((call) => call.method === 'deleteFriend').map((call) => [call.owner, call.friend]),
    [
      ['wayang_demo_001', 'wayang_demo_002'],
      ['wayang_demo_001', 'wayang_demo_003'],
      ['wayang_demo_001', 'wayang_demo_004'],
      ['wayang_demo_001', 'wayang_demo_005'],
      ['wayang_demo_002', 'wayang_demo_001'],
    ],
  );
  assert.deepEqual(calls.filter((call) => call.method === 'addFriend').map((call) => [call.owner, call.friend]), [
    ['wayang_demo_001', 'wayang_demo_002'],
    ['wayang_demo_001', 'wayang_demo_004'],
    ['wayang_demo_002', 'wayang_demo_001'],
  ]);
  assert.deepEqual(calls.find((call) => call.method === 'createGroup').payload.members, [
    'wayang_demo_008',
    'wayang_demo_009',
  ]);
  assert.deepEqual(calls.find((call) => call.method === 'createChatRoom').payload.members, [
    'wayang_demo_013',
    'wayang_demo_014',
  ]);

  const envText = await fs.readFile(result.relationshipsPath, 'utf8');
  assert.match(envText, /GROUP_ID=new-group/);
  assert.match(envText, /ROOM_ID=new-room/);
  assert.match(envText, /CONTACT_FRIEND_TO_ADD_USERNAME=wayang_demo_005/);
  assert.doesNotMatch(envText, /DEFAULT_PASSWORD=/);
});

test('resetRelationships fails if an account is missing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-reset-missing-'));
  const client = {
    async getUser(username) {
      if (username === 'wayang_demo_003') {
        throw new RestError({ method: 'GET', path: `/users/${username}`, status: 404, body: {} });
      }
      return { count: 1, entities: [{ username }] };
    },
  };

  await assert.rejects(
    () => resetRelationships({
      config: makeConfig(dir),
      client,
      logger: makeLogger(),
      stateDir: path.join(dir, '.state'),
    }),
    /Missing required fixture account: wayang_demo_003/,
  );
});

test('resetRelationships ignores missing old resources and missing friend links', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-reset-clean-'));
  const stateDir = path.join(dir, '.state');
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(path.join(stateDir, 'relationships.env'), 'GROUP_ID=old-group\nROOM_ID=old-room\n');
  const client = {
    async getUser(username) {
      return { count: 1, entities: [{ username }] };
    },
    async deleteGroup() {
      throw new RestError({ method: 'DELETE', path: '/chatgroups/old-group', status: 404, body: {} });
    },
    async deleteChatRoom() {
      throw new RestError({ method: 'DELETE', path: '/chatrooms/old-room', status: 404, body: {} });
    },
    async deleteFriend() {
      throw new RestError({ method: 'DELETE', path: '/contacts', status: 404, body: {} });
    },
    async addFriend() {
      return {};
    },
    async createGroup() {
      return { data: { groupid: 'new-group' } };
    },
    async createChatRoom() {
      return { data: { id: 'new-room' } };
    },
  };

  const result = await resetRelationships({
    config: makeConfig(dir),
    client,
    logger: makeLogger(),
    stateDir,
  });

  assert.equal(result.groupId, 'new-group');
  assert.equal(result.roomId, 'new-room');
});

test('resetRelationships removes stale env if reset fails after old resources are deleted', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-reset-fail-'));
  const stateDir = path.join(dir, '.state');
  await fs.mkdir(stateDir, { recursive: true });
  const envPath = path.join(stateDir, 'relationships.env');
  await fs.writeFile(envPath, 'GROUP_ID=old-group\nROOM_ID=old-room\n');
  const client = {
    async getUser(username) {
      return { count: 1, entities: [{ username }] };
    },
    async deleteGroup() {
      return {};
    },
    async deleteChatRoom() {
      return {};
    },
    async deleteFriend() {
      return {};
    },
    async addFriend() {
      return {};
    },
    async createGroup() {
      throw new RestError({ method: 'POST', path: '/chatgroups', status: 500, body: { error: 'server_error' } });
    },
  };

  await assert.rejects(
    () => resetRelationships({
      config: makeConfig(dir),
      client,
      logger: makeLogger(),
      stateDir,
    }),
    /POST \/chatgroups failed/,
  );

  await assert.rejects(
    () => fs.access(envPath),
    /ENOENT/,
  );
});

test('resetRelationships deletes newly created group if chat room creation fails', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-reset-room-fail-'));
  const stateDir = path.join(dir, '.state');
  const calls = [];
  const client = {
    async getUser(username) {
      return { count: 1, entities: [{ username }] };
    },
    async deleteFriend() {
      return {};
    },
    async addFriend() {
      return {};
    },
    async createGroup() {
      calls.push({ method: 'createGroup' });
      return { data: { groupid: 'new-group' } };
    },
    async deleteGroup(groupId) {
      calls.push({ method: 'deleteGroup', groupId });
      return {};
    },
    async createChatRoom() {
      calls.push({ method: 'createChatRoom' });
      throw new RestError({ method: 'POST', path: '/chatrooms', status: 500, body: { error: 'server_error' } });
    },
  };

  await assert.rejects(
    () => resetRelationships({
      config: makeConfig(dir),
      client,
      logger: makeLogger(),
      stateDir,
    }),
    /POST \/chatrooms failed/,
  );

  assert.deepEqual(calls, [
    { method: 'createGroup' },
    { method: 'createChatRoom' },
    { method: 'deleteGroup', groupId: 'new-group' },
  ]);
});

test('resetRelationships deletes newly created group and room if env write fails', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-reset-write-fail-'));
  const stateDir = path.join(dir, '.state');
  const calls = [];
  const client = {
    async getUser(username) {
      return { count: 1, entities: [{ username }] };
    },
    async deleteFriend() {
      return {};
    },
    async addFriend() {
      return {};
    },
    async createGroup() {
      calls.push({ method: 'createGroup' });
      return { data: { groupid: 'new-group' } };
    },
    async createChatRoom() {
      calls.push({ method: 'createChatRoom' });
      return { data: { id: 'new-room' } };
    },
    async deleteGroup(groupId) {
      calls.push({ method: 'deleteGroup', groupId });
      return {};
    },
    async deleteChatRoom(roomId) {
      calls.push({ method: 'deleteChatRoom', roomId });
      return {};
    },
  };

  await assert.rejects(
    () => resetRelationships({
      config: makeConfig(dir),
      client,
      logger: makeLogger(),
      stateDir,
      writeEnvFile: async () => {
        throw new Error('disk full');
      },
    }),
    /disk full/,
  );

  assert.deepEqual(calls.slice(-2), [
    { method: 'deleteChatRoom', roomId: 'new-room' },
    { method: 'deleteGroup', groupId: 'new-group' },
  ]);
});
```

- [ ] **Step 2: Run relationship reset tests and verify failure**

Run:

```bash
cd jmeter/data-fixtures && node --test test/reset-relationships.test.js
```

Expected: FAIL with module not found for `../src/reset-relationships`.

- [ ] **Step 3: Implement relationship reset module**

Create `jmeter/data-fixtures/src/reset-relationships.js`:

```js
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const { loadConfig } = require('./config');
const { readEnvFileIfExists, writeEnvFileAtomic } = require('./env-file');
const {
  CONTACT_CANDIDATE_KEYS,
  RECIPROCAL_FRIEND_KEYS,
  TARGET_FRIEND_KEYS,
  buildFixtureUsers,
  getAllUsernames,
} = require('./fixture-users');
const { createLogger } = require('./logger');
const { EasemobRestClient, isMissingResourceError } = require('./rest-client');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(PACKAGE_DIR, '.state');

async function ensureAccountExists(client, username) {
  try {
    const response = await client.getUser(username);
    if (response.count === 0) {
      throw new Error(`Missing required fixture account: ${username}`);
    }
  } catch (error) {
    if (isMissingResourceError(error)) {
      throw new Error(`Missing required fixture account: ${username}`);
    }
    throw error;
  }
}

function buildRelationshipsEnv({ config, users, groupId, roomId }) {
  return {
    APP_KEY: config.appKey,
    USER_PREFIX: config.userPrefix,
    PRIMARY_USERNAME: users.PRIMARY_USERNAME,
    CONTACT_FRIEND_USERNAME: users.CONTACT_FRIEND_USERNAME,
    CONTACT_NON_FRIEND_USERNAME: users.CONTACT_NON_FRIEND_USERNAME,
    CONTACT_EXISTING_FRIEND_USERNAME: users.CONTACT_EXISTING_FRIEND_USERNAME,
    CONTACT_FRIEND_TO_ADD_USERNAME: users.CONTACT_FRIEND_TO_ADD_USERNAME,
    GROUP_ID: groupId,
    GROUP_OWNER_USERNAME: users.GROUP_OWNER_USERNAME,
    GROUP_MEMBER_USERNAME_1: users.GROUP_MEMBER_USERNAME_1,
    GROUP_MEMBER_USERNAME_2: users.GROUP_MEMBER_USERNAME_2,
    GROUP_NON_MEMBER_USERNAME_1: users.GROUP_NON_MEMBER_USERNAME_1,
    GROUP_NON_MEMBER_USERNAME_2: users.GROUP_NON_MEMBER_USERNAME_2,
    ROOM_ID: roomId,
    ROOM_OWNER_USERNAME: users.ROOM_OWNER_USERNAME,
    ROOM_MEMBER_USERNAME_1: users.ROOM_MEMBER_USERNAME_1,
    ROOM_MEMBER_USERNAME_2: users.ROOM_MEMBER_USERNAME_2,
    ROOM_NON_MEMBER_USERNAME_1: users.ROOM_NON_MEMBER_USERNAME_1,
    ROOM_NON_MEMBER_USERNAME_2: users.ROOM_NON_MEMBER_USERNAME_2,
  };
}

async function ignoreMissingResource(operation, logger, message, details) {
  try {
    await operation();
  } catch (error) {
    if (!isMissingResourceError(error)) {
      throw error;
    }
    logger.info(message, details);
  }
}

async function rollbackNewResources({ client, logger, originalError, createdGroupId, createdRoomId }) {
  if (createdRoomId) {
    try {
      await ignoreMissingResource(
        () => client.deleteChatRoom(createdRoomId),
        logger,
        'New chat room already missing during rollback',
        { roomId: createdRoomId },
      );
    } catch (cleanupError) {
      logger.error('Failed to delete new chat room during rollback', {
        originalError: originalError.message,
        cleanupError: cleanupError.message,
        roomId: createdRoomId,
      });
    }
  }

  if (createdGroupId) {
    try {
      await ignoreMissingResource(
        () => client.deleteGroup(createdGroupId),
        logger,
        'New group already missing during rollback',
        { groupId: createdGroupId },
      );
    } catch (cleanupError) {
      logger.error('Failed to delete new group during rollback', {
        originalError: originalError.message,
        cleanupError: cleanupError.message,
        groupId: createdGroupId,
      });
    }
  }
}

async function resetRelationships({
  config,
  client,
  logger,
  stateDir = DEFAULT_STATE_DIR,
  writeEnvFile = writeEnvFileAtomic,
}) {
  const users = buildFixtureUsers(config.userPrefix, config.defaultPassword);
  const usernames = getAllUsernames(users);
  const relationshipsPath = path.join(stateDir, 'relationships.env');

  logger.info('Validating fixture accounts', { count: usernames.length });
  for (const username of usernames) {
    await ensureAccountExists(client, username);
  }

  const previousEnv = await readEnvFileIfExists(relationshipsPath);

  if (previousEnv.GROUP_ID) {
    logger.info('Deleting previous group', { groupId: previousEnv.GROUP_ID });
    await ignoreMissingResource(
      () => client.deleteGroup(previousEnv.GROUP_ID),
      logger,
      'Previous group already missing',
      { groupId: previousEnv.GROUP_ID },
    );
  }

  if (previousEnv.ROOM_ID) {
    logger.info('Deleting previous chat room', { roomId: previousEnv.ROOM_ID });
    await ignoreMissingResource(
      () => client.deleteChatRoom(previousEnv.ROOM_ID),
      logger,
      'Previous chat room already missing',
      { roomId: previousEnv.ROOM_ID },
    );
  }

  await fs.rm(relationshipsPath, { force: true });
  logger.info('Removed stale relationship fixture data', { relationshipsPath });

  let createdGroupId;
  let createdRoomId;

  try {
    logger.info('Clearing primary contact candidate relationships');
    for (const contactKey of CONTACT_CANDIDATE_KEYS) {
      const friendUsername = users[contactKey];
      await ignoreMissingResource(
        () => client.deleteFriend(users.PRIMARY_USERNAME, friendUsername),
        logger,
        'Primary contact relationship already missing',
        { owner: users.PRIMARY_USERNAME, friend: friendUsername },
      );
    }

    logger.info('Clearing reciprocal stable friend relationships');
    for (const contactKey of RECIPROCAL_FRIEND_KEYS) {
      const friendUsername = users[contactKey];
      await ignoreMissingResource(
        () => client.deleteFriend(friendUsername, users.PRIMARY_USERNAME),
        logger,
        'Reciprocal stable friend relationship already missing',
        { owner: friendUsername, friend: users.PRIMARY_USERNAME },
      );
    }

    logger.info('Adding target primary contact relationships');
    for (const contactKey of TARGET_FRIEND_KEYS) {
      await client.addFriend(users.PRIMARY_USERNAME, users[contactKey]);
    }

    logger.info('Adding reciprocal stable friend relationships');
    for (const contactKey of RECIPROCAL_FRIEND_KEYS) {
      await client.addFriend(users[contactKey], users.PRIMARY_USERNAME);
    }

    const groupName = `${config.userPrefix}_group`;
    const groupResponse = await client.createGroup({
      name: groupName,
      description: 'wayang data fixture group',
      owner: users.GROUP_OWNER_USERNAME,
      members: [users.GROUP_MEMBER_USERNAME_1, users.GROUP_MEMBER_USERNAME_2],
    });
    createdGroupId = groupResponse?.data?.groupid;
    if (!createdGroupId) {
      throw new Error('Missing group ID in group create response');
    }
    logger.info('Created group', { groupId: createdGroupId });

    const roomName = `${config.userPrefix}_room`;
    const roomResponse = await client.createChatRoom({
      name: roomName,
      description: 'wayang data fixture chat room',
      owner: users.ROOM_OWNER_USERNAME,
      members: [users.ROOM_MEMBER_USERNAME_1, users.ROOM_MEMBER_USERNAME_2],
    });
    createdRoomId = roomResponse?.data?.id;
    if (!createdRoomId) {
      throw new Error('Missing room ID in chat room create response');
    }
    logger.info('Created chat room', { roomId: createdRoomId });

    await writeEnvFile(relationshipsPath, buildRelationshipsEnv({
      config,
      users,
      groupId: createdGroupId,
      roomId: createdRoomId,
    }));
    logger.info('Wrote relationship fixture data', {
      relationshipsPath,
      groupId: createdGroupId,
      roomId: createdRoomId,
    });

    return { relationshipsPath, groupId: createdGroupId, roomId: createdRoomId };
  } catch (error) {
    logger.error('Relationship reset failed; cleaning newly created resources', { message: error.message });
    await rollbackNewResources({ client, logger, originalError: error, createdGroupId, createdRoomId });
    throw error;
  }
}

async function runCli() {
  let logger;
  try {
    const config = await loadConfig(PACKAGE_DIR);
    logger = await createLogger({
      stateDir: DEFAULT_STATE_DIR,
      commandName: 'reset-relationships',
      token: config.restAppToken,
    });
    logger.info('Loaded config', { configPath: config.configPath });
    const client = new EasemobRestClient({ ...config, logger });
    const result = await resetRelationships({ config, client, logger });
    await logger.close();

    console.log('Reset fixture relationships');
    console.log(`Data file: ${result.relationshipsPath}`);
    console.log(`GROUP_ID: ${result.groupId}`);
    console.log(`ROOM_ID: ${result.roomId}`);
    console.log(`Log file: ${logger.logPath}`);
  } catch (error) {
    if (logger) {
      logger.error('Command failed', {
        message: error.message,
        method: error.method,
        path: error.path,
        status: error.status,
        error: error.body?.error,
        exception: error.body?.exception,
        error_description: error.body?.error_description,
      });
      await logger.close();
      console.error(`Command failed. Log file: ${logger.logPath}`);
    } else {
      console.error(`Command failed: ${error.message}`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  buildRelationshipsEnv,
  resetRelationships,
};
```

- [ ] **Step 4: Run relationship reset tests and verify pass**

Run:

```bash
cd jmeter/data-fixtures && node --test test/reset-relationships.test.js
```

Expected: PASS.

---

### Task 9: Full Verification and Documentation Check

**Files:**
- Modify if needed: `jmeter/data-fixtures/README.md`
- No code creation expected unless tests expose an implementation gap.

- [ ] **Step 1: Run full data-fixtures test suite**

Run:

```bash
cd jmeter/data-fixtures && node --test
```

Expected: PASS for all tests.

- [ ] **Step 2: Verify package scripts**

Run:

```bash
cd jmeter/data-fixtures && node -e "const pkg=require('./package.json'); console.log(Object.keys(pkg.scripts).sort().join('\\n'))"
```

Expected output includes exactly these scripts:

```text
delete:accounts
prepare:accounts
reset:relationships
test
```

- [ ] **Step 3: Verify local config and state are ignored**

Run:

```bash
cd jmeter/data-fixtures && git check-ignore config.local.cjs .state/accounts.env .state/logs/example.log
```

Expected output:

```text
config.local.cjs
.state/accounts.env
.state/logs/example.log
```

- [ ] **Step 4: Verify missing config CLI failure is readable**

Run:

```bash
cd jmeter/data-fixtures && node src/prepare-accounts.js prepare
```

Expected: exits non-zero if `config.local.cjs` is absent, with console output starting:

```text
Command failed: Missing config.local.cjs
```

If a developer has a real `config.local.cjs`, temporarily move it outside the
package, run this check, then move it back.

- [ ] **Step 5: Verify no token-bearing local files are tracked**

Run:

```bash
git status --short jmeter/data-fixtures
```

Expected: only source, tests, README, `package.json`, `.gitignore`, and
`config.example.cjs` are shown as tracked or untracked candidates. No
`config.local.cjs`, `.state/`, `.env`, or `.log` files appear.

- [ ] **Step 6: Single final commit**

After every task passes, commit all implementation files once:

```bash
git add jmeter/data-fixtures
git commit -m "Add JMeter data fixtures tooling"
```

Expected: one implementation commit containing the complete `jmeter/data-fixtures/`
package. Do not create per-task commits.

---

## Self-Review

Spec coverage:

- Independent Node.js package under `jmeter/data-fixtures/`: Task 1.
- `config.example.cjs` and ignored `config.local.cjs`: Tasks 1, 2, 9.
- Yarn package manager pinning: Task 1.
- Fixed 16-account mapping: Task 3.
- Account prepare and delete scripts: Task 7.
- Account deletion cleans previous relationship resources and removes both env
  output files: Task 7.
- `.state/accounts.env` flat output: Tasks 4 and 7.
- Relationship reset account validation: Task 8.
- Delete/recreate old group and room, remove stale current relationship output,
  and roll back newly created resources on partial failure: Task 8.
- Contact target state with bidirectional `CONTACT_FRIEND_USERNAME` and
  primary-account-only specialized contact fixtures: Task 8.
- Group and chat room creation target states: Task 8.
- `.state/relationships.env` flat output: Tasks 4 and 8.
- Unique file logging and token redaction: Task 5 and command integration in Tasks 7 and 8.
- REST timeout and network-error method/path context: Task 6.
- Strict error handling and non-fatal missing-resource cases: Tasks 6, 7, and 8.
- No third-party dependencies: Tasks 1 and 9.
- Single final commit: Task 9.

Completeness scan:

- No placeholders or unspecified implementation steps remain.

Type and naming consistency:

- Script names match `package.json`.
- Fixture role keys match the V2 spec.
- Relationship output uses `GROUP_ID` and `ROOM_ID`.
- Config path is fixed to `config.local.cjs`; no `--config` support is introduced.
