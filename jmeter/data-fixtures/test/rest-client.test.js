'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { EasemobRestClient, RestError, isMissingResourceError } = require('../src/rest-client');

function makeClient(fetchImpl, logger = { info() {}, error() {} }) {
  return new EasemobRestClient({
    restHost: 'http://a1.easemob.com',
    restOrgName: '1135220126133718',
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
  assert.equal(calls[0].url, 'http://a1.easemob.com/1135220126133718/demo/users');
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
  await client.removeBlockUser('owner', 'blocked');
  await client.createGroup({ name: 'g', description: 'd', owner: 'owner', members: ['m1'] });
  await client.deleteGroup('group1');
  await client.createChatRoom({ name: 'r', description: 'd', owner: 'owner', members: ['m1'] });
  await client.deleteChatRoom('room1');

  assert.deepEqual(calls.map((call) => `${call.options.method} ${new URL(call.url).pathname}${new URL(call.url).search}`), [
    'GET /1135220126133718/demo/users/user1',
    'PUT /1135220126133718/demo/users/user1/password',
    'DELETE /1135220126133718/demo/users/user1',
    'POST /1135220126133718/demo/users/owner/contacts/users/friend',
    'DELETE /1135220126133718/demo/users/owner/contacts/users/friend',
    'DELETE /1135220126133718/demo/users/owner/blocks/users/blocked',
    'POST /1135220126133718/demo/chatgroups',
    'DELETE /1135220126133718/demo/chatgroups/group1',
    'POST /1135220126133718/demo/chatrooms',
    'DELETE /1135220126133718/demo/chatrooms/room1',
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
