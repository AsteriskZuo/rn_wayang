#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../../..');
const measuredRoot = path.join(repoRoot, 'measured_app');
const ts = require(path.join(measuredRoot, 'node_modules/typescript'));

const sdkSrc = path.join(
  measuredRoot,
  'node_modules/react-native-chat-sdk/lib/typescript/src',
);
const bizSrc = path.join(measuredRoot, 'src/biz');
const dispatchSrc = path.join(measuredRoot, 'src/dispatch');

const MANAGERS = [
  {
    sdkClass: 'ChatClient',
    sdkFile: 'ChatClient.d.ts',
    bizClass: 'BizChatClient',
    bizFile: 'BizChatClient.ts',
    generatedFile: 'ChatClient.generated.ts',
  },
  {
    sdkClass: 'ChatManager',
    sdkFile: 'ChatManager.d.ts',
    bizClass: 'BizChatManager',
    bizFile: 'BizChatManager.ts',
    generatedFile: 'ChatManager.generated.ts',
  },
  {
    sdkClass: 'ChatGroupManager',
    sdkFile: 'ChatGroupManager.d.ts',
    bizClass: 'BizChatGroupManager',
    bizFile: 'BizChatGroupManager.ts',
    generatedFile: 'ChatGroupManager.generated.ts',
  },
  {
    sdkClass: 'ChatRoomManager',
    sdkFile: 'ChatRoomManager.d.ts',
    bizClass: 'BizChatRoomManager',
    bizFile: 'BizChatRoomManager.ts',
    generatedFile: 'ChatRoomManager.generated.ts',
  },
  {
    sdkClass: 'ChatContactManager',
    sdkFile: 'ChatContactManager.d.ts',
    bizClass: 'BizChatContactManager',
    bizFile: 'BizChatContactManager.ts',
    generatedFile: 'ChatContactManager.generated.ts',
  },
  {
    sdkClass: 'ChatPresenceManager',
    sdkFile: 'ChatPresenceManager.d.ts',
    bizClass: 'BizChatPresenceManager',
    bizFile: 'BizChatPresenceManager.ts',
    generatedFile: 'ChatPresenceManager.generated.ts',
  },
  {
    sdkClass: 'ChatPushManager',
    sdkFile: 'ChatPushManager.d.ts',
    bizClass: 'BizChatPushManager',
    bizFile: 'BizChatPushManager.ts',
    generatedFile: 'ChatPushManager.generated.ts',
  },
  {
    sdkClass: 'ChatUserInfoManager',
    sdkFile: 'ChatUserInfoManager.d.ts',
    bizClass: 'BizChatUserInfoManager',
    bizFile: 'BizChatUserInfoManager.ts',
    generatedFile: 'ChatUserInfoManager.generated.ts',
  },
];

const DEFAULT_DEPRECATED_PROTOCOL_EXCEPTIONS = new Map([
  [
    'ChatClient.login',
    'username/password JMeter setup command in src/dispatch/Internal.ts',
  ],
]);

const DEFAULT_PROTOCOL_HELPERS = new Set([
  'init',
  'login',
  'addConnectionDelegate',
  'deleteConnectionDelegate',
  'addMultiDeviceDelegate',
  'deleteMultiDeviceDelegate',
  'addContactManagerDelegate',
  'removeContactManagerDelegate',
  'addChatManagerDelegate',
  'removeChatManagerDelegate',
  'addRoomManagerDelegate',
  'removeRoomManagerDelegate',
  'addGroupManagerDelegate',
  'removeGroupManagerDelegate',
]);

const DEFAULT_LEGACY_METHOD_HINTS = [
  ['BizChatClient.getCurrentUserName', 'ChatClient.getCurrentUsername'],
  ['BizChatClient.getIsConnected', 'ChatClient.isConnected'],
  ['BizChatClient.accessToken', 'ChatClient.getAccessToken'],
  ['BizChatManager.fetchSupportLanguages', 'ChatManager.fetchSupportedLanguages'],
  ['BizChatManager.fetchGroupReadAcks', 'ChatManager.fetchGroupAcks'],
  ['BizChatManager.loadMessage', 'ChatManager.getMessage'],
  ['BizChatManager.loadMessagesWithMsgType', 'ChatManager.getMsgsWithMsgType'],
  ['BizChatManager.loadMessages', 'ChatManager.getMsgs'],
  ['BizChatManager.loadMessagesWithKeyword', 'ChatManager.getMsgsWithKeyword'],
  ['BizChatManager.loadMessagesWithTime', 'ChatManager.getMsgWithTimestamp'],
  ['BizChatManager.lastReceivedMessage', 'ChatManager.getLatestReceivedMessage'],
  ['BizChatManager.unReadCount', 'ChatManager.getConversationUnreadCount'],
  ['BizChatManager.markAllMessageAsRead', 'ChatManager.markAllMessagesAsRead'],
  ['BizChatManager.deleteConversationFromServer', 'ChatManager.removeConversationFromServer'],
  ['BizChatManager.loadAllConversations', 'ChatManager.getAllConversations'],
  ['BizChatGroupManager.getGroupFileListFromServer', 'ChatGroupManager.fetchGroupFileListFromServer'],
  ['BizChatGroupManager.deleteGroupSharedFile', 'ChatGroupManager.removeGroupSharedFile'],
  ['BizChatGroupManager.updateGroupExt', 'ChatGroupManager.updateGroupExtension'],
  ['BizChatGroupManager.getGroupAnnouncementFromServer', 'ChatGroupManager.fetchAnnouncementFromServer'],
  ['BizChatGroupManager.getGroupMemberListFromServer', 'ChatGroupManager.fetchMemberListFromServer'],
  ['BizChatGroupManager.applyJoinToGroup', 'ChatGroupManager.requestToJoinPublicGroup'],
  ['BizChatGroupManager.changeGroupOwner', 'ChatGroupManager.changeOwner'],
  ['BizChatGroupManager.addGroupMembers', 'ChatGroupManager.addMembers'],
  ['BizChatGroupManager.deleteGroupMembers', 'ChatGroupManager.removeMembers'],
  ['BizChatGroupManager.unBlockGroup', 'ChatGroupManager.unblockGroup'],
  ['BizChatRoomManager.changeRoomName', 'ChatRoomManager.changeChatRoomSubject'],
  ['BizChatRoomManager.changeRoomDescription', 'ChatRoomManager.changeChatRoomDescription'],
  ['BizChatRoomManager.changeRoomOwner', 'ChatRoomManager.changeOwner'],
  ['BizChatRoomManager.createRoom', 'ChatRoomManager.createChatRoom'],
  ['BizChatRoomManager.destroyRoom', 'ChatRoomManager.destroyChatRoom'],
  ['BizChatRoomManager.fetchPublicRoomsFromServer', 'ChatRoomManager.fetchPublicChatRoomsFromServer'],
  ['BizChatRoomManager.addRoomAttributes', 'ChatRoomManager.addAttributes'],
  ['BizChatRoomManager.removeRoomAttributes', 'ChatRoomManager.removeAttributes'],
  ['BizChatPresenceManager.subscribePresences', 'ChatPresenceManager.subscribe'],
  ['BizChatPresenceManager.unsubscribePresences', 'ChatPresenceManager.unsubscribe'],
  ['BizChatPushManager.getPreferredNotificationLanguage', 'ChatPushManager.fetchPreferredNotificationLanguage'],
  ['BizChatPushManager.getPushConfigFromServer', 'ChatPushManager.fetchPushOptionFromServer'],
  ['BizChatPushManager.updatePushNickName', 'ChatPushManager.updatePushNickname'],
  ['BizChatPushManager.setPushStyle', 'ChatPushManager.updatePushDisplayStyle'],
  ['BizChatUserInfoManager.fetchUserInfoByUserId', 'ChatUserInfoManager.fetchUserInfoById'],
  ['BizChatUserInfoManager.updateOwnInfo', 'ChatUserInfoManager.updateOwnUserInfo'],
];

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sourceFile(filePath) {
  return ts.createSourceFile(
    filePath,
    readFile(filePath),
    ts.ScriptTarget.Latest,
    true,
  );
}

function methodName(member) {
  if (!member.name) {
    return undefined;
  }
  if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
    return member.name.text;
  }
  return member.name.getText();
}

function findClass(source, className) {
  let found;

  function visit(node) {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return found;
}

function hasDeprecatedTag(node) {
  return ts
    .getJSDocTags(node)
    .some(tag => tag.tagName.getText() === 'deprecated');
}

function hasPromiseReturn(node) {
  const returnType = node.type?.getText() ?? '';
  return /^Promise(?:<|$)/.test(returnType);
}

function isStatic(member) {
  return Boolean(
    member.modifiers?.some(
      modifier => modifier.kind === ts.SyntaxKind.StaticKeyword,
    ),
  );
}

function collectSdkMethods(manager) {
  const filePath = path.join(sdkSrc, manager.sdkFile);
  const source = sourceFile(filePath);
  const classNode = findClass(source, manager.sdkClass);

  if (!classNode) {
    throw new Error(`SDK class not found: ${manager.sdkClass} in ${filePath}`);
  }

  const active = [];
  const deprecated = [];

  for (const member of classNode.members) {
    if (!ts.isMethodDeclaration(member) || !hasPromiseReturn(member)) {
      continue;
    }

    const name = methodName(member);
    if (!name) {
      continue;
    }

    const item = `${manager.sdkClass}.${name}`;
    if (hasDeprecatedTag(member)) {
      deprecated.push(item);
    } else {
      active.push(item);
    }
  }

  return {active, deprecated};
}

function collectBizMethods(manager) {
  const filePath = path.join(bizSrc, manager.bizFile);
  const source = sourceFile(filePath);
  const classNode = findClass(source, manager.bizClass);

  if (!classNode) {
    throw new Error(`Biz class not found: ${manager.bizClass} in ${filePath}`);
  }

  const methods = [];

  for (const member of classNode.members) {
    if (!ts.isMethodDeclaration(member) || !isStatic(member)) {
      continue;
    }
    const name = methodName(member);
    if (name) {
      methods.push(`${manager.bizClass}.${name}`);
    }
  }

  return methods;
}

function collectGeneratedRoutes(manager) {
  const filePath = path.join(dispatchSrc, manager.generatedFile);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const source = sourceFile(filePath);
  const routes = [];

  function visit(node) {
    if (ts.isCaseClause(node)) {
      const expression = node.expression;
      if (ts.isStringLiteral(expression)) {
        const cmd = expression.text;
        routes.push(cmd.includes('.') ? cmd : `${manager.sdkClass}.${cmd}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return routes;
}

function sdkToBizMethod(manager, sdkMethod) {
  return sdkMethod.replace(`${manager.sdkClass}.`, `${manager.bizClass}.`);
}

function byManagerAndName(left, right) {
  return left.localeCompare(right);
}

function printSection(title, items, emptyText = 'none') {
  console.log('');
  console.log(`${title}:`);
  if (items.length === 0) {
    console.log(`- ${emptyText}`);
    return;
  }
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function readPipelineItems() {
  if (process.argv.includes('--input')) {
    const inputIndex = process.argv.indexOf('--input');
    const inputValue = process.argv[inputIndex + 1];
    if (inputValue !== '-') {
      throw new Error('Only --input - is supported.');
    }

    const input = fs.readFileSync(0, 'utf8').trim();
    if (input.length === 0) {
      return {hasPipelineInput: true, items: []};
    }

    return {
      hasPipelineInput: true,
      items: input.split(/\r?\n/).map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`Invalid JSONL on input line ${index + 1}: ${line}`);
        }
      }),
    };
  }

  return {hasPipelineInput: false, items: []};
}

function inputProtocolRoutes(items) {
  return items.filter(item => item.type === 'protocol-route');
}

function inputLegacyHints(items) {
  return items
    .filter(item => item.type === 'legacy-alias-candidate')
    .map(item => [item.legacy, item.target]);
}

function createAuditInputs(input, deprecatedSdkSet) {
  const {hasPipelineInput, items} = input;
  const protocolRoutes = inputProtocolRoutes(items);
  const protocolHelpers =
    hasPipelineInput
      ? new Set(
          protocolRoutes.flatMap(route => [
            route.cmd,
            route.sdkMethod?.split('.').at(-1),
          ]),
        )
      : DEFAULT_PROTOCOL_HELPERS;

  const deprecatedProtocolExceptions = new Map();
  if (hasPipelineInput) {
    for (const route of protocolRoutes) {
      if (route.sdkMethod && deprecatedSdkSet.has(route.sdkMethod)) {
        deprecatedProtocolExceptions.set(
          route.sdkMethod,
          route.reason ?? 'protocol/internal route',
        );
      }
    }
  } else {
    for (const [method, reason] of DEFAULT_DEPRECATED_PROTOCOL_EXCEPTIONS) {
      deprecatedProtocolExceptions.set(method, reason);
    }
  }

  const legacyHints = items.filter(item => item.type === 'legacy-alias-candidate');

  return {
    protocolHelpers,
    deprecatedProtocolExceptions,
    legacyHints:
      hasPipelineInput || legacyHints.length > 0
        ? legacyHints
        : DEFAULT_LEGACY_METHOD_HINTS.map(([legacy, target]) => ({
            legacy,
            target,
            score: 1,
            source: 'default',
          })),
  };
}

function main() {
  const input = readPipelineItems();
  const managerData = [];
  const activeSdk = [];
  const deprecatedSdk = [];
  const bizMethods = [];
  const generatedRoutes = [];

  for (const manager of MANAGERS) {
    const sdkMethods = collectSdkMethods(manager);
    const managerBizMethods = collectBizMethods(manager);
    const managerGeneratedRoutes = collectGeneratedRoutes(manager);
    const managerBizSet = new Set(managerBizMethods);

    managerData.push({
      manager,
      sdkMethods,
      managerBizSet,
    });
    activeSdk.push(...sdkMethods.active);
    deprecatedSdk.push(...sdkMethods.deprecated);
    bizMethods.push(...managerBizMethods);
    generatedRoutes.push(...managerGeneratedRoutes);
  }

  const activeSdkSet = new Set(activeSdk);
  const deprecatedSdkSet = new Set(deprecatedSdk);
  const {protocolHelpers, deprecatedProtocolExceptions, legacyHints} =
    createAuditInputs(input, deprecatedSdkSet);
  const missingActiveWrappers = [];
  const deprecatedWrappers = [];

  for (const {manager, sdkMethods, managerBizSet} of managerData) {
    for (const sdkMethod of sdkMethods.active) {
      const bizMethod = sdkToBizMethod(manager, sdkMethod);
      const method = sdkMethod.split('.').at(-1);
      if (!protocolHelpers.has(method) && !managerBizSet.has(bizMethod)) {
        missingActiveWrappers.push(sdkMethod);
      }
    }

    for (const sdkMethod of sdkMethods.deprecated) {
      const bizMethod = sdkToBizMethod(manager, sdkMethod);
      if (
        managerBizSet.has(bizMethod) &&
        !deprecatedProtocolExceptions.has(sdkMethod)
      ) {
        deprecatedWrappers.push(sdkMethod);
      }
    }
  }

  const generatedRouteSet = new Set(generatedRoutes);
  const routedActive = activeSdk.filter(method => generatedRouteSet.has(method));
  const activeWrappersNotRouted = activeSdk.filter(
    method =>
      !generatedRouteSet.has(method) &&
      !missingActiveWrappers.includes(method) &&
      !protocolHelpers.has(method.split('.').at(-1)),
  );
  const routeWithoutActiveSdk = generatedRoutes.filter(
    route => !activeSdkSet.has(route) && !protocolHelpers.has(route.split('.').at(-1)),
  );
  const possibleLegacyWrappers = legacyHints
    .filter(({legacy, target}) => {
      return bizMethods.includes(legacy) && activeSdkSet.has(target);
    })
    .map(({legacy, target, score, source}) => {
      const details = [`score ${score ?? 'n/a'}`];
      if (source) {
        details.push(source);
      }
      return `${legacy} may map to ${target} (${details.join(', ')})`;
    });

  console.log('chat sdk api alignment audit');
  console.log('');
  console.log(`active sdk promise APIs: ${activeSdk.length}`);
  console.log(`biz static methods: ${bizMethods.length}`);
  console.log(`generated active routes: ${routedActive.length}`);

  printSection(
    'missing active wrappers',
    missingActiveWrappers.sort(byManagerAndName),
  );
  printSection(
    'deprecated wrappers present',
    deprecatedWrappers.sort(byManagerAndName),
  );
  printSection(
    'deprecated protocol exceptions',
    [...deprecatedProtocolExceptions.entries()].map(
      ([method, reason]) => `${method} - ${reason}`,
    ),
  );
  printSection(
    'possible legacy or implementation mismatch wrappers',
    possibleLegacyWrappers.sort(byManagerAndName),
  );
  printSection(
    'generated dispatch coverage',
    [
      `active wrappers routed: ${routedActive.length}`,
      `active wrappers not routed: ${activeWrappersNotRouted.length}`,
      `routes without active sdk method: ${routeWithoutActiveSdk.length}`,
    ],
  );

  if (activeWrappersNotRouted.length > 0) {
    printSection(
      'active wrappers not routed',
      activeWrappersNotRouted.sort(byManagerAndName),
    );
  }

  if (routeWithoutActiveSdk.length > 0) {
    printSection(
      'routes without active sdk method',
      routeWithoutActiveSdk.sort(byManagerAndName),
    );
  }
}

main();
