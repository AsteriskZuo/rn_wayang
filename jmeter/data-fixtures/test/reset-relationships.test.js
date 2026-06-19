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
    restHost: 'http://a1.easemob.com',
    restOrgName: '1135220126133718',
    restAppName: 'demo',
    restAppToken: 'token-value',
    userPrefix: 'wayang_demo',
    defaultPassword: 'qwerty',
    appKey: '1135220126133718#demo',
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
