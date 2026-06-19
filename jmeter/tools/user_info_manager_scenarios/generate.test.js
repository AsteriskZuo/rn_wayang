const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const generator = require('./generate');

const expectedFilenames = [
  'user-info-own-query.jmx',
  'user-info-batch-query.jmx',
  'user-info-update-lifecycle.jmx',
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

test('buildAllPlans returns exactly the three approved plans and can write them', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-info-manager-plans-'));
  const plans = generator.buildAllPlans(targetDir);

  assert.deepEqual(Object.keys(plans), expectedFilenames);
  assert.deepEqual(fs.readdirSync(targetDir).sort(), [...expectedFilenames].sort());
});

test('buildAllPlans does not delete unrelated JMX files in target directory', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-info-manager-plans-'));
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

test('fixture loader validates user info env keys, shared keys, and ready marker', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const key of [
    'APP_KEY',
    'DEFAULT_PASSWORD',
    'PRIMARY_USERNAME',
    'PRIMARY_PASSWORD',
    'CONTACT_FRIEND_USERNAME',
    'CHAT_PEER_USERNAME',
    'GROUP_OWNER_USERNAME',
    'ROOM_OWNER_USERNAME',
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

test('fixture loader maps documented user info variables', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const variableName of [
    'appKey',
    'username',
    'password',
    'defaultPassword',
    'primaryUserId',
    'contactFriendUserId',
    'chatPeerUserId',
    'groupOwnerUserId',
    'roomOwnerUserId',
    'queryUserIds',
  ]) {
    assert.match(xml, new RegExp(`vars\\.put\\('${variableName}'`));
  }
});

test('fixture loader logs in as primary account by default', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  assert.match(xml, /vars\.put\('username', props\.get\('username'\) \?: accounts\.PRIMARY_USERNAME\)/);
  assert.match(xml, /vars\.put\('password', props\.get\('password'\) \?: accounts\.PRIMARY_PASSWORD\)/);
});

test('own query scenario fetches own info and verifies primary user id', () => {
  const xml = generator.buildAllPlans()['user-info-own-query.jmx'];

  assert.match(xml, /ChatUserInfoManager\.fetchOwnInfo/);
  assert.match(xml, /断言 primaryUserId 存在于自己的用户信息/);
  assert.doesNotMatch(xml, /ChatUserInfoManager\.updateOwnUserInfo/);
});

test('batch query scenario fetches multiple fixture users by id', () => {
  const xml = generator.buildAllPlans()['user-info-batch-query.jmx'];

  assert.match(xml, /ChatUserInfoManager\.fetchUserInfoById/);
  assert.match(xml, /&quot;ids&quot;:&quot;\$\{queryUserIds\}&quot;/);
  assert.match(xml, /断言批量用户信息包含 fixture 用户/);
  assert.match(xml, /primaryUserId/);
  assert.match(xml, /contactFriendUserId/);
  assert.match(xml, /chatPeerUserId/);
});

test('update lifecycle scenario updates own info and verifies the runtime values', () => {
  const xml = generator.buildAllPlans()['user-info-update-lifecycle.jmx'];
  const update = xml.indexOf('ChatUserInfoManager.updateOwnUserInfo');
  const fetch = xml.indexOf('ChatUserInfoManager.fetchOwnInfo');
  const assertion = xml.indexOf('断言自己的用户信息包含运行时更新值');

  assert.ok(update >= 0);
  assert.ok(fetch > update);
  assert.ok(assertion > fetch);
  assert.match(xml, /nickName/);
  assert.match(xml, /avatarUrl/);
  assert.match(xml, /email/);
  assert.match(xml, /phone/);
  assert.match(xml, /gender&quot;:\$\{gender\}/);
  assert.match(xml, /sign/);
  assert.match(xml, /birth/);
  assert.match(xml, /ext/);
});

test('generated XML includes basic parseable markers for all plans', () => {
  for (const xml of Object.values(generator.buildAllPlans())) {
    assert.equal((xml.match(/<hashTree>/g) ?? []).length, (xml.match(/<\/hashTree>/g) ?? []).length);
    assert.equal((xml.match(/<ThreadGroup\b/g) ?? []).length, 1);
    assert.equal((xml.match(/<TestPlan\b/g) ?? []).length, 1);
    assert.doesNotMatch(xml, /undefined|null<\/stringProp>/);
  }
});
