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

const MANAGERS = [
  {
    sdkClass: 'ChatClient',
    sdkFile: 'ChatClient.d.ts',
    bizClass: 'BizChatClient',
    bizFile: 'BizChatClient.ts',
  },
  {
    sdkClass: 'ChatManager',
    sdkFile: 'ChatManager.d.ts',
    bizClass: 'BizChatManager',
    bizFile: 'BizChatManager.ts',
  },
  {
    sdkClass: 'ChatGroupManager',
    sdkFile: 'ChatGroupManager.d.ts',
    bizClass: 'BizChatGroupManager',
    bizFile: 'BizChatGroupManager.ts',
  },
  {
    sdkClass: 'ChatRoomManager',
    sdkFile: 'ChatRoomManager.d.ts',
    bizClass: 'BizChatRoomManager',
    bizFile: 'BizChatRoomManager.ts',
  },
  {
    sdkClass: 'ChatContactManager',
    sdkFile: 'ChatContactManager.d.ts',
    bizClass: 'BizChatContactManager',
    bizFile: 'BizChatContactManager.ts',
  },
  {
    sdkClass: 'ChatPresenceManager',
    sdkFile: 'ChatPresenceManager.d.ts',
    bizClass: 'BizChatPresenceManager',
    bizFile: 'BizChatPresenceManager.ts',
  },
  {
    sdkClass: 'ChatPushManager',
    sdkFile: 'ChatPushManager.d.ts',
    bizClass: 'BizChatPushManager',
    bizFile: 'BizChatPushManager.ts',
  },
  {
    sdkClass: 'ChatUserInfoManager',
    sdkFile: 'ChatUserInfoManager.d.ts',
    bizClass: 'BizChatUserInfoManager',
    bizFile: 'BizChatUserInfoManager.ts',
  },
];

const TOKEN_SYNONYMS = new Map([
  ['get', 'fetch'],
  ['fetch', 'get'],
  ['delete', 'remove'],
  ['remove', 'delete'],
  ['change', 'update'],
  ['update', 'change'],
  ['room', 'chatroom'],
  ['chatroom', 'room'],
  ['whitelist', 'allowlist'],
  ['allowlist', 'whitelist'],
  ['username', 'username'],
]);

const CONFLICTING_VERBS = new Map([
  ['add', new Set(['remove', 'delete', 'destroy', 'unblock', 'unmute'])],
  ['create', new Set(['remove', 'delete', 'destroy'])],
  ['delete', new Set(['add', 'create', 'upload', 'accept'])],
  ['destroy', new Set(['add', 'create'])],
  ['remove', new Set(['add', 'create', 'upload', 'accept'])],
  ['upload', new Set(['delete', 'remove', 'destroy'])],
]);

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

function collectSdkActiveMethods(manager) {
  const filePath = path.join(sdkSrc, manager.sdkFile);
  const source = sourceFile(filePath);
  const classNode = findClass(source, manager.sdkClass);
  const methods = [];

  if (!classNode) {
    throw new Error(`SDK class not found: ${manager.sdkClass} in ${filePath}`);
  }

  for (const member of classNode.members) {
    if (
      ts.isMethodDeclaration(member) &&
      hasPromiseReturn(member) &&
      !hasDeprecatedTag(member)
    ) {
      const name = methodName(member);
      if (name) {
        methods.push(name);
      }
    }
  }

  return methods;
}

function collectBizMethods(manager) {
  const filePath = path.join(bizSrc, manager.bizFile);
  const source = sourceFile(filePath);
  const classNode = findClass(source, manager.bizClass);
  const methods = [];

  if (!classNode) {
    throw new Error(`Biz class not found: ${manager.bizClass} in ${filePath}`);
  }

  for (const member of classNode.members) {
    if (ts.isMethodDeclaration(member) && isStatic(member)) {
      const name = methodName(member);
      if (name) {
        methods.push({
          name,
          sdkCall: findSdkCall(member),
        });
      }
    }
  }

  return methods;
}

function findSdkCall(member) {
  let found;

  function visit(node) {
    if (found) {
      return;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'tryCatch' &&
      node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      found = findSdkCallInNode(node.arguments[0]);
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(member);
  return found;
}

function findSdkCallInNode(node) {
  if (!node) {
    return undefined;
  }

  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression)
  ) {
    const receiverText = node.expression.expression.getText();
    if (receiverText.includes('ChatClient.getInstance().')) {
      return node.expression.name.text;
    }
  }

  let found;
  function visit(child) {
    if (found) {
      return;
    }
    found = findSdkCallInNode(child);
  }
  ts.forEachChild(node, visit);
  return found;
}

function tokens(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function normalizedTokens(name) {
  return tokens(name).map(token => TOKEN_SYNONYMS.get(token) ?? token);
}

function tokenOverlap(left, right) {
  const leftTokens = new Set(normalizedTokens(left));
  const rightTokens = new Set(normalizedTokens(right));
  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function scoreAlias(legacy, target) {
  const legacyLower = legacy.toLowerCase();
  const targetLower = target.toLowerCase();

  if (legacyLower === targetLower) {
    return 1;
  }

  const overlap = tokenOverlap(legacy, target);
  if (overlap >= 0.75) {
    return overlap;
  }

  return 0;
}

function hasConflictingVerb(legacy, target) {
  const legacyTokens = new Set(normalizedTokens(legacy));
  const targetTokens = new Set(normalizedTokens(target));

  for (const [verb, conflicts] of CONFLICTING_VERBS) {
    if (!legacyTokens.has(verb)) {
      continue;
    }
    for (const conflict of conflicts) {
      if (targetTokens.has(conflict)) {
        return true;
      }
    }
  }

  return false;
}

function main() {
  for (const manager of MANAGERS) {
    const sdkMethods = collectSdkActiveMethods(manager);
    const sdkMethodSet = new Set(sdkMethods);
    const bizMethods = collectBizMethods(manager);

    for (const bizMethod of bizMethods) {
      if (sdkMethodSet.has(bizMethod.name)) {
        continue;
      }

      if (bizMethod.sdkCall && sdkMethodSet.has(bizMethod.sdkCall)) {
        console.log(
          JSON.stringify({
            type: 'legacy-alias-candidate',
            legacy: `${manager.bizClass}.${bizMethod.name}`,
            target: `${manager.sdkClass}.${bizMethod.sdkCall}`,
            score: 1,
            source: 'wrapper-call',
          }),
        );
        continue;
      }

      const candidates = sdkMethods
        .map(sdkMethod => ({
          sdkMethod,
          score: scoreAlias(bizMethod.name, sdkMethod),
        }))
        .filter(
          candidate =>
            candidate.score >= 0.75 &&
            !hasConflictingVerb(bizMethod.name, candidate.sdkMethod),
        )
        .sort((left, right) => right.score - left.score);

      if (candidates.length === 0) {
        continue;
      }

      const candidate = candidates[0];
      console.log(
          JSON.stringify({
            type: 'legacy-alias-candidate',
          legacy: `${manager.bizClass}.${bizMethod.name}`,
          target: `${manager.sdkClass}.${candidate.sdkMethod}`,
          score: Number(candidate.score.toFixed(2)),
          source: 'heuristic',
        }),
      );
    }
  }
}

main();
