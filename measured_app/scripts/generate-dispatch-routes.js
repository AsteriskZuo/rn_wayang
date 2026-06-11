#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const sdkSrc = path.join(
  projectRoot,
  'node_modules/react-native-chat-sdk/lib/typescript/src',
);
const bizSrc = path.join(projectRoot, 'src/biz');
const dispatchSrc = path.join(projectRoot, 'src/dispatch');

const MANAGERS = [
  {
    sdkClass: 'ChatClient',
    sdkFile: 'ChatClient.d.ts',
    bizClass: 'BizChatClient',
    bizFile: 'BizChatClient.ts',
    generatedFile: 'ChatClient.generated.ts',
    dispatchName: 'dispatchChatClient',
  },
  {
    sdkClass: 'ChatManager',
    sdkFile: 'ChatManager.d.ts',
    bizClass: 'BizChatManager',
    bizFile: 'BizChatManager.ts',
    generatedFile: 'ChatManager.generated.ts',
    dispatchName: 'dispatchChatManager',
  },
  {
    sdkClass: 'ChatGroupManager',
    sdkFile: 'ChatGroupManager.d.ts',
    bizClass: 'BizChatGroupManager',
    bizFile: 'BizChatGroupManager.ts',
    generatedFile: 'ChatGroupManager.generated.ts',
    dispatchName: 'dispatchChatGroupManager',
  },
  {
    sdkClass: 'ChatRoomManager',
    sdkFile: 'ChatRoomManager.d.ts',
    bizClass: 'BizChatRoomManager',
    bizFile: 'BizChatRoomManager.ts',
    generatedFile: 'ChatRoomManager.generated.ts',
    dispatchName: 'dispatchChatRoomManager',
  },
  {
    sdkClass: 'ChatContactManager',
    sdkFile: 'ChatContactManager.d.ts',
    bizClass: 'BizChatContactManager',
    bizFile: 'BizChatContactManager.ts',
    generatedFile: 'ChatContactManager.generated.ts',
    dispatchName: 'dispatchChatContactManager',
  },
  {
    sdkClass: 'ChatPresenceManager',
    sdkFile: 'ChatPresenceManager.d.ts',
    bizClass: 'BizChatPresenceManager',
    bizFile: 'BizChatPresenceManager.ts',
    generatedFile: 'ChatPresenceManager.generated.ts',
    dispatchName: 'dispatchChatPresenceManager',
  },
  {
    sdkClass: 'ChatPushManager',
    sdkFile: 'ChatPushManager.d.ts',
    bizClass: 'BizChatPushManager',
    bizFile: 'BizChatPushManager.ts',
    generatedFile: 'ChatPushManager.generated.ts',
    dispatchName: 'dispatchChatPushManager',
  },
  {
    sdkClass: 'ChatUserInfoManager',
    sdkFile: 'ChatUserInfoManager.d.ts',
    bizClass: 'BizChatUserInfoManager',
    bizFile: 'BizChatUserInfoManager.ts',
    generatedFile: 'ChatUserInfoManager.generated.ts',
    dispatchName: 'dispatchChatUserInfoManager',
  },
];

const GENERATED_DEPRECATED_ROUTES = new Map([
  ['ChatClient', new Set(['login'])],
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

function isStatic(member) {
  return Boolean(
    member.modifiers?.some(
      modifier => modifier.kind === ts.SyntaxKind.StaticKeyword,
    ),
  );
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
    if (!ts.isMethodDeclaration(member)) {
      continue;
    }
    if (!hasPromiseReturn(member)) {
      continue;
    }

    const name = methodName(member);
    if (!name) {
      continue;
    }

    if (hasDeprecatedTag(member)) {
      deprecated.push(name);
    } else {
      active.push(name);
    }
  }

  return {active, deprecated};
}

function generatedDeprecatedRoutes(manager) {
  return GENERATED_DEPRECATED_ROUTES.get(manager.sdkClass) ?? new Set();
}

function collectBizMethods(manager) {
  const filePath = path.join(bizSrc, manager.bizFile);
  const source = sourceFile(filePath);
  const classNode = findClass(source, manager.bizClass);

  if (!classNode) {
    throw new Error(`Biz class not found: ${manager.bizClass} in ${filePath}`);
  }

  const methods = new Set();

  for (const member of classNode.members) {
    if (!ts.isMethodDeclaration(member) || !isStatic(member)) {
      continue;
    }
    const name = methodName(member);
    if (name) {
      methods.add(name);
    }
  }

  return methods;
}

function unique(values) {
  return [...new Set(values)];
}

function renderGeneratedRoute(manager, routeMethods) {
  const cases = routeMethods
    .map(
      name => `    case '${manager.sdkClass}.${name}':
      ${manager.bizClass}.${name}(info, callback);
      return true;`,
    )
    .join('\n');

  return `// Generated by scripts/generate-dispatch-routes.js.
// Review generated diffs before committing.

import {ReturnCallback} from '../RNWS';
import {Logger} from '../Logger';
import {${manager.bizClass}} from '../biz/${manager.bizClass}';

export function ${manager.dispatchName}(
  cmd: string,
  info: any,
  callback: ReturnCallback,
  logUnknown = true,
): boolean {
  switch (cmd) {
${cases}
    default:
      if (logUnknown) {
        Logger.raw.warn(\`${manager.sdkClass}: unknown cmd: \${cmd}\`);
      }
      return false;
  }
}
`;
}

function renderIndex() {
  const exports = MANAGERS.map(manager => {
    const moduleName = manager.generatedFile.replace(/\.ts$/, '');
    return `export {${manager.dispatchName}} from './${moduleName}';`;
  });
  exports.push("export {dispatchInternal} from './Internal';");
  return `${exports.join('\n')}\n`;
}

function ensureNoDuplicateRoutes(manager, routeMethods) {
  const duplicates = routeMethods.filter(
    (name, index) => routeMethods.indexOf(name) !== index,
  );
  if (duplicates.length > 0) {
    throw new Error(
      `${manager.sdkClass} generated duplicate routes: ${unique(
        duplicates,
      ).join(', ')}`,
    );
  }
}

function writeGeneratedFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, content);
}

function main() {
  const summary = {
    generated: [],
    missingWrappers: [],
    deprecatedSkipped: [],
    deprecatedGenerated: [],
  };

  for (const manager of MANAGERS) {
    const {active, deprecated} = collectSdkMethods(manager);
    const bizMethods = collectBizMethods(manager);

    const routeMethods = [];
    for (const name of active) {
      if (bizMethods.has(name)) {
        routeMethods.push(name);
      } else {
        summary.missingWrappers.push(`${manager.sdkClass}.${name}`);
      }
    }

    const generatedDeprecated = generatedDeprecatedRoutes(manager);
    for (const name of deprecated) {
      if (bizMethods.has(name)) {
        if (generatedDeprecated.has(name)) {
          routeMethods.push(name);
          summary.deprecatedGenerated.push(`${manager.sdkClass}.${name}`);
        } else {
          summary.deprecatedSkipped.push(`${manager.sdkClass}.${name}`);
        }
      }
    }

    ensureNoDuplicateRoutes(manager, routeMethods);

    const outputPath = path.join(dispatchSrc, manager.generatedFile);
    writeGeneratedFile(outputPath, renderGeneratedRoute(manager, routeMethods));
    summary.generated.push(`${manager.generatedFile}: ${routeMethods.length}`);
  }

  writeGeneratedFile(path.join(dispatchSrc, 'index.ts'), renderIndex());

  console.log('dispatch route generation complete');
  console.log('');
  console.log('generated routes:');
  for (const item of summary.generated) {
    console.log(`- ${item}`);
  }

  if (summary.missingWrappers.length > 0) {
    console.log('');
    console.log('missing wrapper, not generated:');
    for (const item of summary.missingWrappers) {
      console.log(`- ${item}`);
    }
  }

  if (summary.deprecatedSkipped.length > 0) {
    console.log('');
    console.log('deprecated SDK API skipped:');
    for (const item of summary.deprecatedSkipped) {
      console.log(`- ${item}`);
    }
  }

  if (summary.deprecatedGenerated.length > 0) {
    console.log('');
    console.log('deprecated SDK API generated by explicit exception:');
    for (const item of summary.deprecatedGenerated) {
      console.log(`- ${item}`);
    }
  }
}

main();
