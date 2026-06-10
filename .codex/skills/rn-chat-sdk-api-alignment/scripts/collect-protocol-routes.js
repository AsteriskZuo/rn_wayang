#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../../..');
const measuredRoot = path.join(repoRoot, 'measured_app');
const ts = require(path.join(measuredRoot, 'node_modules/typescript'));
const internalPath = path.join(measuredRoot, 'src/dispatch/Internal.ts');

const BIZ_TO_SDK_CLASS = new Map([
  ['BizChatClient', 'ChatClient'],
  ['BizChatContactManager', 'ChatContactManager'],
  ['BizChatGroupManager', 'ChatGroupManager'],
  ['BizChatManager', 'ChatManager'],
  ['BizChatRoomManager', 'ChatRoomManager'],
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

function sdkMethodFromStatement(statement) {
  if (
    !ts.isExpressionStatement(statement) ||
    !ts.isCallExpression(statement.expression)
  ) {
    return undefined;
  }

  const expression = statement.expression.expression;
  if (ts.isPropertyAccessExpression(expression)) {
    const receiver = expression.expression;
    if (ts.isIdentifier(receiver) && BIZ_TO_SDK_CLASS.has(receiver.text)) {
      return `${BIZ_TO_SDK_CLASS.get(receiver.text)}.${expression.name.text}`;
    }
  }

  return undefined;
}

function main() {
  const source = sourceFile(internalPath);

  function visit(node) {
    if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression)) {
      const sdkMethod = node.statements
        .map(statement => sdkMethodFromStatement(statement))
        .find(Boolean);

      if (sdkMethod) {
        console.log(
          JSON.stringify({
            type: 'protocol-route',
            cmd: node.expression.text,
            sdkMethod,
            reason: 'protocol/internal route in src/dispatch/Internal.ts',
          }),
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
}

main();
