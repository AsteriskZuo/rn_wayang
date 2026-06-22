const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const generator = require('./generate');

const expectedFilenames = [
  'chat-room-info-query.jmx',
  'chat-room-member-presence.jmx',
  'chat-room-metadata-lifecycle.jmx',
  'chat-room-moderation-lifecycle.jmx',
  'chat-room-create-destroy-lifecycle.jmx',
  'chat-room-attributes-lifecycle.jmx',
];

test('scenario filenames stay in the approved order', () => {
  assert.deepEqual(
    generator.scenarioDefinitions.map(scenario => scenario.filename),
    expectedFilenames,
  );
});

test('scenario modules expose the generator contract', () => {
  assert.equal(typeof generator.buildAllPlans, 'function');
  assert.equal(typeof generator.buildPlan, 'function');
  assert.equal(typeof generator.xmlEscape, 'function');
  assert.ok(Array.isArray(generator.scenarioDefinitions));

  for (const scenario of generator.scenarioDefinitions) {
    assert.equal(typeof scenario.filename, 'string');
    assert.equal(typeof scenario.name, 'string');
    assert.ok(Array.isArray(scenario.variables));
    assert.ok(Array.isArray(scenario.samplers));
  }
});

test('xmlEscape escapes JMX string property characters', () => {
  assert.equal(
    generator.xmlEscape('<tag attr="x&y">ok</tag>'),
    '&lt;tag attr=&quot;x&amp;y&quot;&gt;ok&lt;/tag&gt;',
  );
});

test('buildAllPlans returns exactly the six approved plans and can write them', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-room-manager-plans-'));
  const plans = generator.buildAllPlans(targetDir);

  assert.deepEqual(Object.keys(plans), expectedFilenames);
  assert.deepEqual(fs.readdirSync(targetDir).sort(), [...expectedFilenames].sort());
});

test('buildAllPlans does not delete unrelated JMX files in target directory', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-room-manager-plans-'));
  const unrelatedPath = path.join(targetDir, 'unrelated-plan.jmx');
  fs.writeFileSync(unrelatedPath, 'keep me');

  generator.buildAllPlans(targetDir);

  assert.equal(fs.readFileSync(unrelatedPath, 'utf8'), 'keep me');
});

test('each plan contains shared JMeter structure and ordinary lifecycle samplers', () => {
  for (const [filename, xml] of Object.entries(generator.buildAllPlans())) {
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<jmeterTestPlan\b/);
    assert.match(xml, /<TestPlan\b/);
    assert.match(xml, /<ThreadGroup\b/);
    assert.match(xml, /ThreadGroup\.on_sample_error">stopthread/);
    assert.match(xml, /<Arguments guiclass="ArgumentsPanel"/);
    assert.match(xml, /<eu\.luminis\.jmeter\.wssampler\.RequestResponseWebSocketSampler/);
    assert.match(xml, /Load fixture env/);
    assert.match(xml, /ChatClient\.init/);
    assert.match(xml, /ChatClient\.login/);
    assert.match(xml, /ChatClient\.logout/);
    assert.match(xml, /&quot;ok&quot;:true/);
    assert.match(xml, /PRECONDITION_FAILED/);
    assert.match(xml, /ctx\.getThread\(\)\.stop\(\)/);
    assert.match(xml, /View Results Tree/);
    assert.match(xml, /Summary Report/);
    assert.doesNotMatch(xml, /setUpThreadGroup/);
    assert.doesNotMatch(xml, /PostThreadGroup/);
    assert.doesNotMatch(xml, /tearDown ThreadGroup/i);
    assert.ok(filename.endsWith('.jmx'));
  }
});

test('fixture loader validates chat room env keys, shared keys, and ready marker', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const key of [
    'APP_KEY',
    'DEFAULT_PASSWORD',
    'PRIMARY_USERNAME',
    'PRIMARY_PASSWORD',
    'ROOM_ID',
    'ROOM_OWNER_USERNAME',
    'ROOM_MEMBER_USERNAME_1',
    'ROOM_MEMBER_USERNAME_2',
    'ROOM_NON_MEMBER_USERNAME_1',
    'ROOM_NON_MEMBER_USERNAME_2',
    'CONTACT_FIXTURE_READY',
  ]) {
    assert.match(xml, new RegExp(key), `${key} should be validated or mapped`);
  }

  assert.match(xml, /accountsEnvPath/);
  assert.match(xml, /relationshipsEnvPath/);
  assert.match(xml, /jmeter\/data-fixtures\/\.state\/accounts\.env/);
  assert.match(xml, /jmeter\/data-fixtures\/\.state\/relationships\.env/);
  assert.match(xml, /shared fixture key mismatch/);
  assert.match(xml, /CONTACT_FIXTURE_READY=true/);
  assert.match(xml, /run or repair yarn reset:relationships/);
  assert.match(xml, /throw new IllegalStateException\(message\)/);
});

test('fixture loader maps documented chat room variables', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const variableName of [
    'appKey',
    'username',
    'password',
    'defaultPassword',
    'primaryUserId',
    'roomId',
    'roomOwnerUserId',
    'roomMemberUserId1',
    'roomMemberUserId2',
    'roomNonMemberUserId1',
    'roomNonMemberUserId2',
  ]) {
    assert.match(xml, new RegExp(`vars\\.put\\('${variableName}'`));
  }
});

test('fixture loader logs in as chat room owner by default for management APIs', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  assert.match(xml, /vars\.put\('username', props\.get\('username'\) \?: relationships\.ROOM_OWNER_USERNAME\)/);
  assert.match(xml, /vars\.put\('password', props\.get\('password'\) \?: accounts\.DEFAULT_PASSWORD\)/);
});

test('info query scenario verifies fixture room and member data without mutation', () => {
  const xml = generator.buildAllPlans()['chat-room-info-query.jmx'];

  assert.match(xml, /ChatRoomManager\.getChatRoomWithId/);
  assert.match(xml, /ChatRoomManager\.fetchChatRoomInfoFromServer/);
  assert.match(xml, /ChatRoomManager\.fetchChatRoomMembers/);
  assert.match(xml, /ChatRoomManager\.fetchPublicChatRoomsFromServer/);
  assert.match(xml, /断言 fixture roomId 存在/);
  assert.match(xml, /断言 roomMemberUserId1 在聊天室成员列表中/);
  assert.doesNotMatch(xml, /ChatRoomManager\.removeChatRoomMembers/);
  assert.doesNotMatch(xml, /ChatRoomManager\.destroyChatRoom/);
});

test('member presence scenario lets prepared non-member join and leave', () => {
  const xml = generator.buildAllPlans()['chat-room-member-presence.jmx'];
  const logoutOwner = xml.indexOf('切换前退出房主');
  const loginNonMember = xml.indexOf('登录准备好的非成员');
  const join = xml.indexOf('ChatRoomManager.joinChatRoomEx');
  const verifyJoined = xml.indexOf('断言 roomNonMemberUserId1 在成员列表中');
  const leave = xml.indexOf('ChatRoomManager.leaveChatRoom');
  const verifyLeft = xml.indexOf('断言 roomNonMemberUserId1 不在成员列表中');

  assert.ok(logoutOwner >= 0);
  assert.ok(loginNonMember > logoutOwner);
  assert.ok(join > loginNonMember);
  assert.ok(verifyJoined > join);
  assert.ok(leave > verifyJoined);
  assert.ok(verifyLeft > leave);
});

test('metadata scenario mutates fixture room with run-unique values', () => {
  const xml = generator.buildAllPlans()['chat-room-metadata-lifecycle.jmx'];

  assert.match(xml, /ChatRoomManager\.changeChatRoomSubject/);
  assert.match(xml, /ChatRoomManager\.changeChatRoomDescription/);
  assert.match(xml, /ChatRoomManager\.updateChatRoomAnnouncement/);
  assert.match(xml, /ChatRoomManager\.fetchChatRoomAnnouncement/);
  assert.match(xml, /chat room scenario \$\{__time\(\)\}/);
  assert.match(xml, /断言聊天室公告等于运行时值/);
});

test('moderation scenario restores mute block admin and allow-list state', () => {
  const xml = generator.buildAllPlans()['chat-room-moderation-lifecycle.jmx'];
  const addAdmin = xml.indexOf('ChatRoomManager.addChatRoomAdmin');
  const removeAdmin = xml.indexOf('ChatRoomManager.removeChatRoomAdmin');
  const mute = xml.indexOf('ChatRoomManager.muteChatRoomMembers');
  const unmute = xml.indexOf('ChatRoomManager.unMuteChatRoomMembers');
  const block = xml.indexOf('ChatRoomManager.blockChatRoomMembers');
  const unblock = xml.indexOf('ChatRoomManager.unBlockChatRoomMembers');
  const allow = xml.indexOf('ChatRoomManager.addMembersToChatRoomAllowList');
  const disallow = xml.indexOf('ChatRoomManager.removeMembersFromChatRoomAllowList');

  assert.ok(addAdmin >= 0);
  assert.ok(removeAdmin > addAdmin);
  assert.ok(mute > removeAdmin);
  assert.ok(unmute > mute);
  assert.ok(block > unmute);
  assert.ok(unblock > block);
  assert.ok(allow > unblock);
  assert.ok(disallow > allow);
  assert.match(xml, /拉黑聊天室成员/);
  assert.match(xml, /断言 roomMemberUserId1 在聊天室黑名单中/);
  assert.doesNotMatch(xml, /拉黑非成员/);
  assert.doesNotMatch(xml, /断言 roomNonMemberUserId1 在聊天室黑名单中/);
});

test('create destroy scenario extracts runtime room id and destroys it', () => {
  const xml = generator.buildAllPlans()['chat-room-create-destroy-lifecycle.jmx'];

  assert.match(xml, /ChatRoomManager\.createChatRoom/);
  assert.match(xml, /createdRoomId/);
  assert.match(xml, /maxUserCount&quot;:\$\{createdRoomMaxCount\}/);
  assert.match(xml, /ChatRoomManager\.destroyChatRoom/);
  assert.match(xml, /断言 createdRoomId 存在/);
});

test('attributes scenario adds fetches and removes run-scoped attributes', () => {
  const xml = generator.buildAllPlans()['chat-room-attributes-lifecycle.jmx'];
  const add = xml.indexOf('ChatRoomManager.addAttributes');
  const fetchAdded = xml.indexOf('断言聊天室属性包含运行时值');
  const remove = xml.indexOf('ChatRoomManager.removeAttributes');
  const fetchRemoved = xml.indexOf('断言聊天室属性已移除');

  assert.ok(add >= 0);
  assert.ok(fetchAdded > add);
  assert.ok(remove > fetchAdded);
  assert.ok(fetchRemoved > remove);
  assert.match(xml, /roomAttributeKey/);
  assert.match(xml, /roomAttributeValue/);
  assert.match(xml, /&quot;attributes&quot;:\s*\[\{/);
  assert.match(xml, /deleteWhenLeft&quot;:false/);
  assert.match(xml, /overwrite&quot;:true/);
  assert.doesNotMatch(xml, /&quot;attributes&quot;:\s*\{&quot;\$\{roomAttributeKey\}/);
});

test('generated XML includes basic parseable markers for all plans', () => {
  for (const xml of Object.values(generator.buildAllPlans())) {
    assert.equal((xml.match(/<hashTree>/g) ?? []).length, (xml.match(/<\/hashTree>/g) ?? []).length);
    assert.equal((xml.match(/<ThreadGroup\b/g) ?? []).length, 1);
    assert.equal((xml.match(/<TestPlan\b/g) ?? []).length, 1);
    assert.doesNotMatch(xml, /undefined|null<\/stringProp>/);
  }
});
