const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const generator = require('./generate');

const expectedFilenames = [
  'contact-list-query.jmx',
  'contact-remark-lifecycle.jmx',
  'contact-add-request-prepared-delete.jmx',
  'contact-invitation-request-path-smoke.jmx',
  'contact-block-list-lifecycle.jmx',
  'contact-pagination-cursor.jmx',
  'contact-self-platform-smoke.jmx',
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

test('buildAllPlans returns exactly the seven approved plans and can write them', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contact-manager-plans-'));
  const plans = generator.buildAllPlans(targetDir);

  assert.deepEqual(Object.keys(plans), expectedFilenames);
  assert.deepEqual(fs.readdirSync(targetDir).sort(), [...expectedFilenames].sort());
});

test('buildAllPlans does not delete unrelated JMX files in target directory', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contact-manager-plans-'));
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

test('fixture loader validates required env keys, shared keys, and ready marker', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const key of [
    'APP_KEY',
    'DEFAULT_PASSWORD',
    'PRIMARY_USERNAME',
    'PRIMARY_PASSWORD',
    'CONTACT_FRIEND_USERNAME',
    'CONTACT_NON_FRIEND_USERNAME',
    'CONTACT_EXISTING_FRIEND_USERNAME',
    'CONTACT_FRIEND_TO_ADD_USERNAME',
    'CONTACT_INVITATION_SMOKE_USERNAME',
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

test('fixture loader sampler writes to its own SampleResult', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);
  const loadFixtureStart = xml.indexOf('testname="Load fixture env"');
  const initStart = xml.indexOf('cmd&quot;: &quot;ChatClient.init&quot;');
  const loadFixtureXml = xml.slice(loadFixtureStart, initStart);

  assert.ok(loadFixtureStart >= 0);
  assert.ok(initStart > loadFixtureStart);
  assert.match(loadFixtureXml, /def result = SampleResult/);
  assert.match(loadFixtureXml, /result\.setResponseData/);
  assert.match(loadFixtureXml, /result\.setSuccessful\(false\)/);
  assert.doesNotMatch(loadFixtureXml, /prev\.setResponseData/);
  assert.doesNotMatch(loadFixtureXml, /prev\.setSuccessful/);
});

test('fixture loader maps documented contact variables', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const variableName of [
    'appKey',
    'username',
    'password',
    'defaultPassword',
    'primaryUserId',
    'contactFriendUserId',
    'contactNonFriendUserId',
    'contactExistingFriendUserId',
    'contactFriendToAddUserId',
    'contactInvitationSmokeUserId',
  ]) {
    assert.match(xml, new RegExp(`vars\\.put\\('${variableName}'`));
  }
});

test('getAllContactsFromServer appears only in contact-list-query', () => {
  const plans = generator.buildAllPlans();

  for (const [filename, xml] of Object.entries(plans)) {
    const count = (xml.match(/ChatContactManager\.getAllContactsFromServer/g) ?? []).length;
    assert.equal(
      count,
      filename === 'contact-list-query.jmx' ? 1 : 0,
      `${filename} has unexpected getAllContactsFromServer count`,
    );
  }
});

test('contact list scenario verifies stable prepared server contact object', () => {
  const xml = generator.buildAllPlans()['contact-list-query.jmx'];

  assert.match(xml, /断言稳定准备联系人对象存在/);
  assert.match(xml, /\[&quot;contactFriendUserId&quot;\]/);
  assert.doesNotMatch(xml, /\[&quot;contactFriendUserId&quot;,&quot;contactExistingFriendUserId&quot;\]/);
});

test('local cache consistency scenario is not generated', () => {
  const allXml = Object.values(generator.buildAllPlans()).join('\n');

  assert.doesNotMatch(allXml, /local-cache/i);
  assert.doesNotMatch(allXml, /Local Cache Consistency/i);
});

test('scenario 3 and 4 use approved request-path smoke semantics', () => {
  const addDeleteXml = generator.buildAllPlans()['contact-add-request-prepared-delete.jmx'];
  const invitationXml = generator.buildAllPlans()['contact-invitation-request-path-smoke.jmx'];

  assert.match(addDeleteXml, /ChatContactManager\.addContact/);
  assert.match(addDeleteXml, /ChatContactManager\.deleteContact/);
  assert.match(addDeleteXml, /contactFriendToAddUserId/);
  assert.match(addDeleteXml, /contactExistingFriendUserId/);

  assert.match(invitationXml, /ChatContactManager\.acceptInvitation/);
  assert.match(invitationXml, /ChatContactManager\.declineInvitation/);
  assert.match(invitationXml, /contactInvitationSmokeUserId/);
  assert.match(invitationXml, /contactNonFriendUserId/);
  assert.doesNotMatch(invitationXml, /ChatContactManager\.addContact/);
  assert.doesNotMatch(invitationXml, /switch account|secondary login/i);
});

test('block-list lifecycle verifies server present before server absent', () => {
  const xml = generator.buildAllPlans()['contact-block-list-lifecycle.jmx'];
  const add = xml.indexOf('ChatContactManager.addUserToBlockList');
  const verifyPresent = xml.indexOf('断言 blockedUserId 在服务端黑名单中');
  const remove = xml.indexOf('ChatContactManager.removeUserFromBlockList');
  const verifyAbsent = xml.indexOf('断言 blockedUserId 不在服务端黑名单中');

  assert.ok(add >= 0);
  assert.ok(verifyPresent > add);
  assert.ok(remove > verifyPresent);
  assert.ok(verifyAbsent > remove);
});

test('pagination second page sampler runs only when nextCursor is non-empty', () => {
  const xml = generator.buildAllPlans()['contact-pagination-cursor.jmx'];

  assert.match(xml, /nextCursor/);
  assert.match(xml, /vars\.get\('nextCursor'\)/);
  assert.match(xml, /<IfController\b/);
  assert.match(xml, /IfController\.condition/);
  assert.match(xml, /\$\{__groovy\(vars\.get\('nextCursor'\) != null/);
  assert.doesNotMatch(xml, /getSamplerContext\(\)\.setIgnore\(\)/);
  assert.match(xml, /ChatContactManager\.fetchContacts/);
});

test('generated XML includes basic parseable markers for all plans', () => {
  for (const xml of Object.values(generator.buildAllPlans())) {
    assert.equal((xml.match(/<hashTree>/g) ?? []).length, (xml.match(/<\/hashTree>/g) ?? []).length);
    assert.equal((xml.match(/<ThreadGroup\b/g) ?? []).length, 1);
    assert.equal((xml.match(/<TestPlan\b/g) ?? []).length, 1);
    assert.doesNotMatch(xml, /undefined|null<\/stringProp>/);
  }
});
