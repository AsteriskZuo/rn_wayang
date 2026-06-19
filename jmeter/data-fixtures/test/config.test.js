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
    restHost: 'http://a1.easemob.com/',
    restOrgName: '1135220126133718',
    restAppName: 'demo',
    restAppToken: 'token-value',
    userPrefix: 'wayang_demo',
    defaultPassword: 'qwerty',
    requestTimeoutMs: 10000,
  }, '/tmp/config.local.cjs');

  assert.equal(config.restHost, 'http://a1.easemob.com');
  assert.equal(config.appKey, '1135220126133718#demo');
  assert.equal(config.userPrefix, 'wayang_demo');
  assert.equal(config.defaultPassword, 'qwerty');
  assert.equal(config.requestTimeoutMs, 10000);
  assert.equal(config.configPath, '/tmp/config.local.cjs');
});

test('validateConfig defaults requestTimeoutMs', () => {
  const config = validateConfig({
    restHost: 'http://a1.easemob.com',
    restOrgName: '1135220126133718',
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
      restHost: 'http://a1.easemob.com',
      restOrgName: '1135220126133718',
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
      restHost: 'http://a1.easemob.com',
      restOrgName: '1135220126133718',
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
      restHost: 'http://a1.easemob.com',
      restOrgName: '1135220126133718',
      restAppName: 'demo',
      restAppToken: 'token-value',
      userPrefix: 'wayang_demo',
      defaultPassword: 'qwerty',
    };
  `);

  const config = await loadConfig(dir);

  assert.equal(config.appKey, '1135220126133718#demo');
  assert.equal(config.configPath, path.join(dir, 'config.local.cjs'));
});

test('loadConfig fails when config.local.cjs is missing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-config-missing-'));

  await assert.rejects(
    () => loadConfig(dir),
    /Missing config.local.cjs/,
  );
});
