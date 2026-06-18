const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const generator = require('./generate');

const expectedFilenames = [
  'message-basic-lifecycle.jmx',
  'message-send-types.jmx',
  'message-query.jmx',
  'message-recall-delete.jmx',
  'message-translation.jmx',
  'message-reaction.jmx',
  'message-pin.jmx',
  'message-conversation.jmx',
  'message-target-types.jmx',
  'message-thread-management.jmx',
];

test('scenario filenames stay in the approved order', () => {
  assert.deepEqual(
    generator.scenarioDefinitions.map(scenario => scenario.filename),
    expectedFilenames,
  );
});

test('scenario modules expose the parallel implementation contract', () => {
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

test('each plan contains the shared JMeter structure and lifecycle samplers', () => {
  const plans = generator.buildAllPlans();

  assert.deepEqual(Object.keys(plans), expectedFilenames);

  for (const [filename, xml] of Object.entries(plans)) {
    assert.ok(filename.endsWith('.jmx'));
    assert.match(xml, /<ThreadGroup\b/);
    assert.match(xml, /<Arguments guiclass="ArgumentsPanel"/);
    assert.match(xml, /<eu\.luminis\.jmeter\.wssampler\.RequestResponseWebSocketSampler/);
    assert.match(xml, /ChatClient\.init/);
    assert.match(xml, /ChatClient\.login/);
    assert.match(xml, /ChatClient\.logout/);
    assert.match(xml, /安装场景工具方法/);
    assert.match(xml, /&quot;ok&quot;:true/);
    assert.match(xml, /PRECONDITION_FAILED/);
    assert.match(xml, /View Results Tree/);
    assert.match(xml, /Summary Report/);
    assert.match(xml, /ctx\.getThread\(\)\.stop\(\)/);
    assert.match(xml, /ThreadGroup\.on_sample_error">stopthread/);
  }
});

test('plans avoid forbidden thread groups and unstable protocol fields', () => {
  const allXml = Object.values(generator.buildAllPlans()).join('\n');

  assert.doesNotMatch(allXml, /setUpThreadGroup/);
  assert.doesNotMatch(allXml, /PostThreadGroup/);
  assert.doesNotMatch(allXml, /serverRemoveMessageIds/);
  assert.doesNotMatch(allXml, /chatType/);
  assert.doesNotMatch(allXml, /lanuages/);
});

test('generated Groovy scripts avoid JavaScript-only syntax', () => {
  const allXml = Object.values(generator.buildAllPlans()).join('\n');

  assert.doesNotMatch(allXml, /\?\?/);
});

test('typed JMeter variables are emitted as raw JSON values', () => {
  const allXml = Object.values(generator.buildAllPlans()).join('\n');

  for (const field of [
    'count',
    'pageSize',
    'timestamp',
    'startTime',
    'endTime',
    'start',
    'end',
    'isChatThread',
  ]) {
    assert.doesNotMatch(
      allXml,
      new RegExp(`&quot;${field}&quot;:\\s*&quot;\\$\\{[^}]+\\}&quot;`),
      `${field} placeholder must not be quoted`,
    );
  }
});

test('WebSocket connection is opened once by init and reused afterwards', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);
  const trueConnections =
    xml.match(/<boolProp name="createNewConnection">true<\/boolProp>/g) ?? [];
  const falseConnections =
    xml.match(/<boolProp name="createNewConnection">false<\/boolProp>/g) ?? [];

  assert.equal(trueConnections.length, 1);
  assert.ok(falseConnections.length >= 2);
});

test('plans pre-clean stale login state with an ordinary logout sampler after init', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);
  const initIndex = xml.indexOf('cmd&quot;:&quot;ChatClient.init');
  const cleanupIndex = xml.indexOf('预清理退出登录');
  const loginIndex = xml.indexOf('cmd&quot;:&quot;ChatClient.login');

  assert.ok(initIndex >= 0);
  assert.ok(cleanupIndex > initIndex);
  assert.ok(loginIndex > cleanupIndex);
  assert.match(xml, /预清理退出登录/);
  assert.match(xml, /cmd&quot;:&quot;ChatClient\.logout/);
});

test('default WebSocket read timeout allows SDK server calls to complete', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  assert.match(xml, /<stringProp name="Argument.name">timeout<\/stringProp><stringProp name="Argument.value">\$\{__P\(timeout,10000\)\}<\/stringProp>/);
  assert.doesNotMatch(xml, /<stringProp name="Argument.name">timeout<\/stringProp><stringProp name="Argument.value">200<\/stringProp>/);
});

test('runtime connection and credential variables can be overridden with JMeter properties', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  for (const [name, defaultValue] of [
    ['url', 'localhost'],
    ['port', '8083'],
    ['timeout', '10000'],
    ['topic', 'rn'],
    ['appKey', '1135220126133718#demo'],
    ['username', 'asterisk001'],
    ['password', 'qwerty'],
  ]) {
    assert.match(
      xml,
      new RegExp(`<stringProp name="Argument.name">${name}<\\/stringProp><stringProp name="Argument.value">\\$\\{__P\\(${name},${defaultValue}\\)\\}<\\/stringProp>`),
      `${name} should use a JMeter property fallback`,
    );
  }
});

test('exports helpers used by future scenario modules', () => {
  for (const helperName of [
    'wsSampler',
    'jsr223PostProcessor',
    'jsr223PreProcessor',
    'discoverContactSampler',
    'discoverGroupSampler',
    'discoverRoomSampler',
    'sendMessageSampler',
    'scriptSampler',
    'setVarsSampler',
    'rawJson',
  ]) {
    assert.equal(typeof generator[helperName], 'function');
  }
});

test('wsSampler supports raw infoJson variable insertion', () => {
  const xml = generator.wsSampler({
    name: 'raw body sampler',
    cmd: 'ChatManager.modifyMsgBody',
    infoJson: '{"body":${body}}',
  });

  assert.match(xml, /&quot;body&quot;:\$\{body\}/);
});

test('wsSampler asserts obvious SDK error-shaped values by default', () => {
  const xml = generator.wsSampler({
    name: 'success sampler',
    cmd: 'ChatManager.getMessage',
    info: {messageId: '${messageId}'},
  });

  assert.match(xml, /断言 SDK 未返回明显错误/);
  assert.match(xml, /rawResponse\.trim\(\)\.isEmpty\(\)/);
  assert.match(xml, /def value = root instanceof Map/);
  assert.match(xml, /description/);
  assert.match(xml, /ChatError/);
});

test('extraction scripts do not parse empty response after a failed sampler', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  assert.match(xml, /if \(!prev\.isSuccessful\(\)\) \{/);
  assert.match(xml, /rawResponse == null \|\| rawResponse\.trim\(\)\.isEmpty\(\)/);
});

test('shared extraction can use primitive string arrays returned by contact APIs', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  assert.match(xml, /node instanceof CharSequence/);
  assert.match(xml, /return node\.toString\(\)/);
});

test('login sampler accepts already-logged-in SDK response as idempotent success', () => {
  const xml = generator.buildPlan(generator.scenarioDefinitions[0]);

  assert.match(xml, /登录/);
  assert.match(xml, /The user is already logged in/);
  assert.match(xml, /&quot;code&quot;:200/);
});

test('wsSampler can disable SDK success assertions for expected error flows', () => {
  const xml = generator.wsSampler({
    name: 'expected error sampler',
    cmd: 'ChatManager.sendMessage',
    info: {localPath: '/tmp/missing-jmeter-file.bin'},
    assertSdkSuccess: false,
  });

  assert.doesNotMatch(xml, /断言 SDK 未返回明显错误/);
});

test('translation scenario sends languages as a JSON array', () => {
  const xml = generator.buildAllPlans()['message-translation.jmx'];

  assert.match(xml, /&quot;languages&quot;:\s*\[&quot;\$\{languages\}&quot;\]/);
  assert.doesNotMatch(xml, /&quot;languages&quot;:\s*&quot;\$\{languages\}&quot;/);
});

test('buildAllPlans can write and overwrite a target directory', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-manager-plans-'));
  const first = generator.buildAllPlans(targetDir);
  const targetFile = path.join(targetDir, expectedFilenames[0]);

  assert.equal(Object.keys(first).length, 10);
  assert.ok(fs.existsSync(targetFile));

  fs.writeFileSync(targetFile, 'stale');
  const second = generator.buildAllPlans(targetDir);

  assert.equal(Object.keys(second).length, 10);
  assert.notEqual(fs.readFileSync(targetFile, 'utf8'), 'stale');
});

function assertPlanContains(filename, patterns) {
  const xml = generator.buildAllPlans()[filename];

  for (const pattern of patterns) {
    assert.match(xml, pattern, `${filename} missing ${pattern}`);
  }
}

test('basic lifecycle scenario follows send get modify delete get flow', () => {
  assertPlanContains('message-basic-lifecycle.jmx', [
    /发现联系人/,
    /发送 peer 文本消息/,
    /ChatManager\.getMessage - 修改前/,
    /ChatManager\.modifyMsgBody/,
    /&quot;body&quot;:\$\{body\}/,
    /ChatManager\.deleteMessage/,
    /ChatManager\.getMessage - 删除后/,
  ]);
});

test('send types scenario covers message bodies, fixtures, and invalid local path', () => {
  const xml = generator.buildAllPlans()['message-send-types.jmx'];

  for (const pattern of [
    /test-image\.jpg/,
    /test-file\.txt/,
    /test-large-8mb\.bin/,
    /test-audio\.m4a/,
    /test-video\.mp4/,
    /missing-jmeter-file\.bin/,
    /&quot;type&quot;:\s*&quot;text&quot;/,
    /&quot;type&quot;:\s*&quot;image&quot;/,
    /&quot;type&quot;:\s*&quot;file&quot;/,
    /&quot;type&quot;:\s*&quot;voice&quot;/,
    /&quot;type&quot;:\s*&quot;video&quot;/,
    /&quot;type&quot;:\s*&quot;location&quot;/,
    /&quot;type&quot;:\s*&quot;cmd&quot;/,
    /&quot;type&quot;:\s*&quot;custom&quot;/,
  ]) {
    assert.match(xml, pattern);
  }

  assert.match(xml, /发送 cmd 消息/);
  assert.doesNotMatch(xml, /获取 cmd 消息/);
});

test('query scenario covers id type keyword time count and history APIs', () => {
  assertPlanContains('message-query.jmx', [
    /queryKeyword/,
    /ChatManager\.getMessage/,
    /ChatManager\.getMessagesWithIds/,
    /ChatManager\.getMsgs/,
    /ChatManager\.getMsgsWithMsgType/,
    /ChatManager\.getConvMsgsWithKeyword/,
    /ChatManager\.getMsgsWithKeyword/,
    /ChatManager\.getConvsMsgsWithKeyword/,
    /ChatManager\.getMsgWithTimestamp/,
    /ChatManager\.getMessageCountWithTimestamp/,
    /ChatManager\.searchMessages/,
    /ChatManager\.searchMessagesInConversation/,
    /ChatManager\.fetchHistoryMessagesByOptions/,
    /ChatManager\.getMessageCount/,
    /&quot;msgType&quot;:\s*&quot;txt&quot;/,
    /&quot;msgType&quot;:\s*&quot;img&quot;/,
    /&quot;msgTypes&quot;:\s*&quot;txt,img&quot;/,
  ]);
});

test('recall delete scenario keeps destructive cases separate', () => {
  const xml = generator.buildAllPlans()['message-recall-delete.jmx'];

  assert.match(xml, /localDeleteMessageId/);
  assert.match(xml, /serverRemoveMessageId/);
  assert.match(xml, /提取本地时间范围删除窗口/);
  assert.match(xml, /\['serverTime', 'localTime', 'timestamp', 'msgTime'\]/);
  assert.doesNotMatch(xml, /记录本地时间范围开始/);
  assert.doesNotMatch(xml, /记录本地时间范围结束/);
  assert.match(xml, /&quot;messageIds&quot;:\s*&quot;\$\{messageIds\}&quot;/);
  assert.match(xml, /&quot;options&quot;:\s*\{\}/);
  assert.doesNotMatch(xml, /&quot;options&quot;:\s*&quot;\$\{options\}&quot;/);
  for (const command of [
    'ChatManager.deleteMessage',
    'ChatManager.deleteMessagesWithTimestamp',
    'ChatManager.deleteMessagesBeforeTimestamp',
    'ChatManager.recallMessage',
    'ChatManager.removeMessagesFromServerWithMsgIds',
    'ChatManager.removeMessagesFromServerWithTimestamp',
    'ChatManager.deleteConversationAllMessages',
  ]) {
    assert.match(xml, new RegExp(command.replace('.', '\\.')));
  }
  assert.doesNotMatch(xml, /removeConversationFromServer/);
  assert.doesNotMatch(xml, /deleteAllMessageAndConversation/);
});

test('translation reaction and pin scenarios cover their workflows', () => {
  assertPlanContains('message-translation.jmx', [
    /ChatManager\.fetchSupportedLanguages/,
    /ChatManager\.translateMessage/,
    /&quot;languages&quot;:\s*\[&quot;\$\{languages\}&quot;\]/,
    /ChatManager\.getMessage/,
  ]);

  assertPlanContains('message-reaction.jmx', [
    /ChatManager\.addReaction/,
    /ChatManager\.getReactionList/,
    /ChatManager\.fetchReactionDetail/,
    /ChatManager\.fetchReactionList/,
    /ChatManager\.removeReaction/,
    /&quot;messageIds&quot;:\s*&quot;\$\{messageIds\}&quot;/,
    /&quot;conversationType&quot;:\s*&quot;PeerChat&quot;/,
  ]);

  assertPlanContains('message-pin.jmx', [
    /ChatManager\.pinMessage/,
    /ChatManager\.getMessagePinInfo/,
    /ChatManager\.getPinnedMessages/,
    /ChatManager\.fetchPinnedMessages/,
    /ChatManager\.unpinMessage/,
  ]);
});

test('conversation scenario covers conversation APIs without global destructive delete', () => {
  const xml = generator.buildAllPlans()['message-conversation.jmx'];

  for (const command of [
    'ChatManager.getConversation',
    'ChatManager.getAllConversations',
    'ChatManager.getLatestMessage',
    'ChatManager.getLatestReceivedMessage',
    'ChatManager.getUnreadCount',
    'ChatManager.getConversationUnreadCount',
    'ChatManager.getConversationMessageCount',
    'ChatManager.markMessageAsRead',
    'ChatManager.markAllMessagesAsRead',
    'ChatManager.sendConversationReadAck',
    'ChatManager.setConversationExtension',
    'ChatManager.pinConversation',
    'ChatManager.fetchPinnedConversationsFromServerWithCursor',
    'ChatManager.addRemoteAndLocalConversationsMark',
    'ChatManager.fetchConversationsByOptions',
    'ChatManager.deleteRemoteAndLocalConversationsMark',
    'ChatManager.fetchConversationsFromServerWithCursor',
    'ChatManager.deleteConversation',
    'ChatManager.removeConversationFromServer',
  ]) {
    assert.match(xml, new RegExp(command.replace('.', '\\.')));
  }
  assert.match(xml, /&quot;dict&quot;:\$\{dict\}/);
  assert.doesNotMatch(xml, /deleteAllMessageAndConversation/);
  assert.doesNotMatch(xml, /mark_0/);
});

test('target types scenario sends to peer group room and thread', () => {
  const xml = generator.buildAllPlans()['message-target-types.jmx'];

  assert.match(xml, /ChatContactManager\.getAllContactsFromServer/);
  assert.match(xml, /ChatGroupManager\.getJoinedGroups/);
  assert.match(xml, /ChatRoomManager\.fetchPublicChatRoomsFromServer/);
  assert.match(xml, /ChatRoomManager\.joinChatRoomEx/);
  assert.match(xml, /ChatRoomManager\.leaveChatRoom/);
  assert.match(xml, /ChatManager\.createChatThread/);
  assert.match(xml, /&quot;conversationType&quot;:\s*&quot;GroupChat&quot;/);
  assert.match(xml, /&quot;conversationType&quot;:\s*&quot;ChatRoom&quot;/);
  assert.match(xml, /&quot;isChatThread&quot;:\s*true/);
  assert.doesNotMatch(xml, /&quot;chatType&quot;:/);
});

test('thread management scenario covers dynamic thread lifecycle', () => {
  const xml = generator.buildAllPlans()['message-thread-management.jmx'];

  for (const command of [
    'ChatGroupManager.getJoinedGroups',
    'ChatManager.sendMessage',
    'ChatManager.createChatThread',
    'ChatManager.fetchChatThreadFromServer',
    'ChatManager.getMessageThread',
    'ChatManager.getThreadConversation',
    'ChatManager.fetchMembersWithChatThreadFromServer',
    'ChatManager.fetchChatThreadWithParentFromServer',
    'ChatManager.fetchJoinedChatThreadWithParentFromServer',
    'ChatManager.fetchJoinedChatThreadFromServer',
    'ChatManager.fetchLastMessageWithChatThread',
    'ChatManager.updateChatThreadName',
    'ChatManager.destroyChatThread',
  ]) {
    assert.match(xml, new RegExp(command.replace('.', '\\.')));
  }
  assert.doesNotMatch(xml, /removeMemberWithChatThread/);
});
