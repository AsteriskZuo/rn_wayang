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
