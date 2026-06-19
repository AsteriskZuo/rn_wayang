const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const generator = require('./generate');

const expectedFilenames = [
  'group-info-query.jmx',
  'group-member-management.jmx',
  'group-metadata-lifecycle.jmx',
  'group-moderation-lifecycle.jmx',
  'group-create-destroy-lifecycle.jmx',
  'group-shared-file-lifecycle.jmx',
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
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-manager-plans-'));
  const plans = generator.buildAllPlans(targetDir);

  assert.deepEqual(Object.keys(plans), expectedFilenames);
  assert.deepEqual(fs.readdirSync(targetDir).sort(), [...expectedFilenames].sort());
});

test('buildAllPlans does not delete unrelated JMX files in target directory', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-manager-plans-'));
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

test('fixture loader validates group env keys, shared keys, and ready marker', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const key of [
    'APP_KEY',
    'DEFAULT_PASSWORD',
    'PRIMARY_USERNAME',
    'PRIMARY_PASSWORD',
    'GROUP_ID',
    'GROUP_OWNER_USERNAME',
    'GROUP_MEMBER_USERNAME_1',
    'GROUP_MEMBER_USERNAME_2',
    'GROUP_NON_MEMBER_USERNAME_1',
    'GROUP_NON_MEMBER_USERNAME_2',
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

test('fixture loader maps documented group variables', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const variableName of [
    'appKey',
    'username',
    'password',
    'defaultPassword',
    'primaryUserId',
    'groupId',
    'groupOwnerUserId',
    'groupMemberUserId1',
    'groupMemberUserId2',
    'groupNonMemberUserId1',
    'groupNonMemberUserId2',
  ]) {
    assert.match(xml, new RegExp(`vars\\.put\\('${variableName}'`));
  }
});

test('fixture loader logs in as group owner by default for management APIs', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  assert.match(xml, /vars\.put\('username', props\.get\('username'\) \?: relationships\.GROUP_OWNER_USERNAME\)/);
  assert.match(xml, /vars\.put\('password', props\.get\('password'\) \?: accounts\.DEFAULT_PASSWORD\)/);
});

test('info query scenario verifies fixture group and member data without mutation', () => {
  const xml = generator.buildAllPlans()['group-info-query.jmx'];

  assert.match(xml, /ChatGroupManager\.getGroupWithId/);
  assert.match(xml, /ChatGroupManager\.fetchGroupInfoWithoutMembersFromServer/);
  assert.match(xml, /ChatGroupManager\.fetchMemberListFromServer/);
  assert.match(xml, /ChatGroupManager\.fetchJoinedGroupsFromServer/);
  assert.match(xml, /断言 fixture groupId 存在/);
  assert.match(xml, /断言 groupMemberUserId1 在成员列表中/);
  assert.doesNotMatch(xml, /ChatGroupManager\.addMembers/);
  assert.doesNotMatch(xml, /ChatGroupManager\.destroyGroup/);
});

test('member management scenario adds and removes only prepared non-member', () => {
  const xml = generator.buildAllPlans()['group-member-management.jmx'];
  const add = xml.indexOf('ChatGroupManager.addMembers');
  const verifyAdded = xml.indexOf('断言 groupNonMemberUserId1 在成员列表中');
  const remove = xml.indexOf('ChatGroupManager.removeMembers');
  const verifyRemoved = xml.indexOf('断言 groupNonMemberUserId1 不在成员列表中');

  assert.ok(add >= 0);
  assert.ok(verifyAdded > add);
  assert.ok(remove > verifyAdded);
  assert.ok(verifyRemoved > remove);
  assert.match(xml, /groupNonMemberUserId1/);
});

test('metadata scenario mutates fixture group with run-unique values', () => {
  const xml = generator.buildAllPlans()['group-metadata-lifecycle.jmx'];

  assert.match(xml, /ChatGroupManager\.changeGroupName/);
  assert.match(xml, /ChatGroupManager\.changeGroupDescription/);
  assert.match(xml, /ChatGroupManager\.updateGroupAnnouncement/);
  assert.match(xml, /ChatGroupManager\.updateGroupExtension/);
  assert.match(xml, /group scenario \$\{__time\(\)\}/);
  assert.match(xml, /断言群组公告等于运行时值/);
});

test('moderation scenario restores mute block and allow-list state', () => {
  const xml = generator.buildAllPlans()['group-moderation-lifecycle.jmx'];
  const mute = xml.indexOf('ChatGroupManager.muteMembers');
  const unmute = xml.indexOf('ChatGroupManager.unMuteMembers');
  const block = xml.indexOf('ChatGroupManager.blockMembers');
  const unblock = xml.indexOf('ChatGroupManager.unblockMembers');
  const allow = xml.indexOf('ChatGroupManager.addAllowList');
  const disallow = xml.indexOf('ChatGroupManager.removeAllowList');

  assert.ok(mute >= 0);
  assert.ok(unmute > mute);
  assert.ok(block > unmute);
  assert.ok(unblock > block);
  assert.ok(allow > unblock);
  assert.ok(disallow > allow);
});

test('create destroy scenario extracts runtime group id and destroys it', () => {
  const xml = generator.buildAllPlans()['group-create-destroy-lifecycle.jmx'];

  assert.match(xml, /ChatGroupManager\.createGroupEx/);
  assert.match(xml, /createdGroupId/);
  assert.match(xml, /inviteNeedConfirm&quot;:false/);
  assert.match(xml, /ChatGroupManager\.destroyGroup/);
  assert.match(xml, /断言 createdGroupId 存在/);
});

test('shared file scenario uses fixture file helpers and longer timeout', () => {
  const xml = generator.buildAllPlans()['group-shared-file-lifecycle.jmx'];

  assert.match(xml, /ChatGroupManager\.uploadGroupSharedFile/);
  assert.match(xml, /fixtureName/);
  assert.match(xml, /test-file\.txt/);
  assert.match(xml, /ChatGroupManager\.fetchGroupFileListFromServer/);
  assert.match(xml, /groupFileId/);
  assert.match(xml, /saveFilename/);
  assert.match(xml, /ChatGroupManager\.downloadGroupSharedFile/);
  assert.match(xml, /ChatGroupManager\.removeGroupSharedFile/);
  assert.match(xml, /fileTimeout/);
  assert.match(xml, /readTimeout">\$\{fileTimeout\}/);
});

test('generated XML includes basic parseable markers for all plans', () => {
  for (const xml of Object.values(generator.buildAllPlans())) {
    assert.equal((xml.match(/<hashTree>/g) ?? []).length, (xml.match(/<\/hashTree>/g) ?? []).length);
    assert.equal((xml.match(/<ThreadGroup\b/g) ?? []).length, 1);
    assert.equal((xml.match(/<TestPlan\b/g) ?? []).length, 1);
    assert.doesNotMatch(xml, /undefined|null<\/stringProp>/);
  }
});
