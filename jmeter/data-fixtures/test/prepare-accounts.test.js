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
  assert.equal(calls.filter((call) => call.method === 'registerUsers').length, 17);
  assert.equal(calls.filter((call) => call.method === 'resetPassword').length, 0);

  const envText = await fs.readFile(result.accountsPath, 'utf8');
  assert.match(envText, /PRIMARY_USERNAME=wayang_demo_001/);
  assert.match(envText, /CONTACT_INVITATION_SMOKE_USERNAME=wayang_demo_006/);
  assert.match(envText, /ROOM_NON_MEMBER_USERNAME_2=wayang_demo_017/);
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

  assert.equal(calls.filter((call) => call.method === 'getUser').length, 17);
  assert.equal(calls.filter((call) => call.method === 'resetPassword').length, 17);
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
  assert.equal(deleted.length, 17);
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
