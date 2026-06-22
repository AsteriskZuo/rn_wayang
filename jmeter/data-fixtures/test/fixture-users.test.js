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

test('buildFixtureUsers creates stable 17-account mapping', () => {
  const users = buildFixtureUsers('wayang_demo', 'qwerty');

  assert.equal(users.PRIMARY_USERNAME, 'wayang_demo_001');
  assert.equal(users.CONTACT_FRIEND_USERNAME, 'wayang_demo_002');
  assert.equal(users.CONTACT_NON_FRIEND_USERNAME, 'wayang_demo_003');
  assert.equal(users.CONTACT_EXISTING_FRIEND_USERNAME, 'wayang_demo_004');
  assert.equal(users.CONTACT_FRIEND_TO_ADD_USERNAME, 'wayang_demo_005');
  assert.equal(users.CONTACT_INVITATION_SMOKE_USERNAME, 'wayang_demo_006');
  assert.equal(users.CHAT_PEER_USERNAME, 'wayang_demo_007');
  assert.equal(users.GROUP_OWNER_USERNAME, 'wayang_demo_008');
  assert.equal(users.GROUP_MEMBER_USERNAME_1, 'wayang_demo_009');
  assert.equal(users.GROUP_MEMBER_USERNAME_2, 'wayang_demo_010');
  assert.equal(users.GROUP_NON_MEMBER_USERNAME_1, 'wayang_demo_011');
  assert.equal(users.GROUP_NON_MEMBER_USERNAME_2, 'wayang_demo_012');
  assert.equal(users.ROOM_OWNER_USERNAME, 'wayang_demo_013');
  assert.equal(users.ROOM_MEMBER_USERNAME_1, 'wayang_demo_014');
  assert.equal(users.ROOM_MEMBER_USERNAME_2, 'wayang_demo_015');
  assert.equal(users.ROOM_NON_MEMBER_USERNAME_1, 'wayang_demo_016');
  assert.equal(users.ROOM_NON_MEMBER_USERNAME_2, 'wayang_demo_017');
});

test('getAllUsernames returns exactly 17 unique usernames', () => {
  const users = buildFixtureUsers('wayang_demo', 'qwerty');
  const usernames = getAllUsernames(users);

  assert.equal(usernames.length, 17);
  assert.equal(new Set(usernames).size, 17);
  assert.equal(usernames[0], 'wayang_demo_001');
  assert.equal(usernames[16], 'wayang_demo_017');
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
  assert.equal(env.CONTACT_INVITATION_SMOKE_USERNAME, 'wayang_demo_006');
  assert.equal(env.ROOM_NON_MEMBER_USERNAME_2, 'wayang_demo_017');
  assert.equal(Object.hasOwn(env, 'updatedAt'), false);
  assert.equal(Object.hasOwn(env, 'status'), false);
});

test('contact role constants capture reset behavior', () => {
  assert.deepEqual(CONTACT_CANDIDATE_KEYS, [
    'CONTACT_FRIEND_USERNAME',
    'CONTACT_NON_FRIEND_USERNAME',
    'CONTACT_EXISTING_FRIEND_USERNAME',
    'CONTACT_FRIEND_TO_ADD_USERNAME',
    'CONTACT_INVITATION_SMOKE_USERNAME',
  ]);
  assert.deepEqual(TARGET_FRIEND_KEYS, [
    'CONTACT_FRIEND_USERNAME',
    'CONTACT_EXISTING_FRIEND_USERNAME',
  ]);
  assert.deepEqual(RECIPROCAL_FRIEND_KEYS, [
    'CONTACT_FRIEND_USERNAME',
  ]);
});
