# Generated Dispatch Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the mechanical `cmd -> Biz*` manager dispatch route layer from SDK `.d.ts` declarations and existing handwritten `Biz*` wrappers, while keeping `Dispatch.ts` as the handwritten protocol entry point.

**Architecture:** Add a Node.js generator that reads `react-native-chat-sdk` type declarations and `Biz*` static wrapper methods, then writes one generated route file per SDK manager under `measured_app/src/dispatch/` plus a barrel `index.ts`. `Dispatch.ts` keeps parsing/logging/protocol behavior and delegates to generated manager route functions and a handwritten `Internal.ts` for protocol exceptions.

**Tech Stack:** React Native 0.83.2, TypeScript, Node.js, TypeScript compiler API, Yarn 4, existing Jest smoke tests.

---

## Execution Rule

Do not stop after each task to ask the user for a git commit, and do not create per-task commits while executing this plan. Complete implementation and validation first, then report changed files and verification results so the user can decide whether and how to commit.

## File Structure

- Create `measured_app/scripts/generate-dispatch-routes.js`
  - Reads SDK `.d.ts` files and `Biz*` files.
  - Emits `measured_app/src/dispatch/*.generated.ts`.
  - Emits `measured_app/src/dispatch/index.ts`.
  - Reports generated routes, missing wrappers, deprecated skips, and protocol skips.
- Modify `measured_app/package.json`
  - Adds `generate:dispatch`.
- Create `measured_app/src/dispatch/Internal.ts`
  - Handwritten route function for `init`, `login`, and listener/delegate helper commands.
- Generate `measured_app/src/dispatch/ChatClient.generated.ts`
- Generate `measured_app/src/dispatch/ChatManager.generated.ts`
- Generate `measured_app/src/dispatch/ChatGroupManager.generated.ts`
- Generate `measured_app/src/dispatch/ChatRoomManager.generated.ts`
- Generate `measured_app/src/dispatch/ChatContactManager.generated.ts`
- Generate `measured_app/src/dispatch/ChatPresenceManager.generated.ts`
- Generate `measured_app/src/dispatch/ChatPushManager.generated.ts`
- Generate `measured_app/src/dispatch/ChatUserInfoManager.generated.ts`
- Generate `measured_app/src/dispatch/index.ts`
- Modify `measured_app/src/Dispatch.ts`
  - Removes the large handwritten SDK switch.
  - Keeps `dispatch(data, callback): boolean` as the handwritten protocol entry.
  - Calls generated manager dispatchers in fixed order.

## Validation Strategy

Do not add mocked route tests. This app is the test puppet/tool itself. For this task, validation comes from:

- generator output stability;
- generated route structure;
- no calls to missing `Biz*` methods;
- no generated deprecated SDK routes;
- `yarn generate:dispatch`;
- `yarn lint`;
- `yarn test`;
- later real relay/JMeter execution.

## Task 1: Add Generator Script

**Files:**
- Create: `measured_app/scripts/generate-dispatch-routes.js`

- [ ] **Step 1: Create the generator script**

Create `measured_app/scripts/generate-dispatch-routes.js`:

```javascript
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

const PROTOCOL_EXCEPTIONS = new Set(['init', 'login']);

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
    member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword),
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
    if (!name || PROTOCOL_EXCEPTIONS.has(name)) {
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
      name => `    case '${name}':
      ${manager.bizClass}.${name}(info, callback);
      return true;`,
    )
    .join('\n');

  return `// Generated by scripts/generate-dispatch-routes.js.
// Review generated diffs before committing.

import {ReturnCallback} from '../RNWS';
import {${manager.bizClass}} from '../biz/${manager.bizClass}';

export function ${manager.dispatchName}(
  cmd: string,
  info: any,
  callback: ReturnCallback,
): boolean {
  switch (cmd) {
${cases}
    default:
      return false;
  }
}
`;
}

function renderIndex() {
  const exports = MANAGERS.map(
    manager =>
      `export {${manager.dispatchName}} from './${manager.generatedFile.replace(
        /\.ts$/,
        '',
      )}';`,
  );
  exports.push("export {dispatchInternal} from './Internal';");
  return `${exports.join('\n')}\n`;
}

function ensureNoDuplicateRoutes(manager, routeMethods) {
  const duplicates = routeMethods.filter(
    (name, index) => routeMethods.indexOf(name) !== index,
  );
  if (duplicates.length > 0) {
    throw new Error(
      `${manager.sdkClass} generated duplicate routes: ${unique(duplicates).join(
        ', ',
      )}`,
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
    protocolSkipped: [...PROTOCOL_EXCEPTIONS].map(name => `ChatClient.${name}`),
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

    for (const name of deprecated) {
      if (bizMethods.has(name)) {
        summary.deprecatedSkipped.push(`${manager.sdkClass}.${name}`);
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

  console.log('');
  console.log('protocol/internal routes are handled outside generated SDK routes:');
  for (const item of summary.protocolSkipped) {
    console.log(`- ${item}`);
  }
}

main();
```

- [ ] **Step 2: Run the generator directly and confirm it creates route files**

Run from `measured_app`:

```bash
node scripts/generate-dispatch-routes.js
```

Expected:

- command exits `0`;
- `src/dispatch/*.generated.ts` are created;
- `src/dispatch/index.ts` is created;
- output includes `generated routes:`;
- output includes `missing wrapper, not generated:` for APIs whose `Biz*` wrapper does not yet exist;
- output includes `deprecated SDK API skipped:` when same-named deprecated wrappers exist.

- [ ] **Step 3: Record the generator checkpoint**

Do not commit. Note that generated route files now exist and that missing wrappers are reported but not generated.

## Task 2: Add Package Script

**Files:**
- Modify: `measured_app/package.json`

- [ ] **Step 1: Add `generate:dispatch`**

In `measured_app/package.json`, update the `scripts` block to include:

```json
"generate:dispatch": "node scripts/generate-dispatch-routes.js"
```

The scripts block should be:

```json
"scripts": {
  "android": "react-native run-android",
  "ios": "react-native run-ios",
  "lint": "eslint .",
  "start": "react-native start",
  "test": "jest",
  "generate:dispatch": "node scripts/generate-dispatch-routes.js"
}
```

- [ ] **Step 2: Run the package script**

Run from `measured_app`:

```bash
yarn generate:dispatch
```

Expected: same behavior as direct script execution. The command exits `0` and refreshes `src/dispatch/*.generated.ts` plus `src/dispatch/index.ts`.

- [ ] **Step 3: Record the package script checkpoint**

Do not commit. Continue to wiring the handwritten internal routes.

## Task 3: Add Internal Dispatch Routes

**Files:**
- Create: `measured_app/src/dispatch/Internal.ts`

- [ ] **Step 1: Create `Internal.ts`**

Create `measured_app/src/dispatch/Internal.ts`:

```typescript
import {ReturnCallback} from '../RNWS';
import {BizChatClient} from '../biz/BizChatClient';
import {BizChatContactManager} from '../biz/BizChatContactManager';
import {BizChatGroupManager} from '../biz/BizChatGroupManager';
import {BizChatManager} from '../biz/BizChatManager';
import {BizChatRoomManager} from '../biz/BizChatRoomManager';

export function dispatchInternal(
  cmd: string,
  info: any,
  callback: ReturnCallback,
): boolean {
  switch (cmd) {
    case 'init':
      BizChatClient.init(info, callback);
      return true;
    case 'login':
      BizChatClient.login(info, callback);
      return true;
    case 'addConnectionDelegate':
      BizChatClient.addConnectionDelegate(info, callback);
      return true;
    case 'deleteConnectionDelegate':
      BizChatClient.deleteConnectionDelegate(info, callback);
      return true;
    case 'addMultiDeviceDelegate':
      BizChatClient.addMultiDeviceDelegate(info, callback);
      return true;
    case 'deleteMultiDeviceDelegate':
      BizChatClient.deleteMultiDeviceDelegate(info, callback);
      return true;
    case 'addContactManagerDelegate':
      BizChatContactManager.addContactManagerDelegate(info, callback);
      return true;
    case 'removeContactManagerDelegate':
      BizChatContactManager.removeContactManagerDelegate(info, callback);
      return true;
    case 'addChatManagerDelegate':
      BizChatManager.addChatManagerDelegate(info, callback);
      return true;
    case 'removeChatManagerDelegate':
      BizChatManager.removeChatManagerDelegate(info, callback);
      return true;
    case 'addRoomManagerDelegate':
      BizChatRoomManager.addRoomManagerDelegate(info, callback);
      return true;
    case 'removeRoomManagerDelegate':
      BizChatRoomManager.removeRoomManagerDelegate(info, callback);
      return true;
    case 'addGroupManagerDelegate':
      BizChatGroupManager.addGroupManagerDelegate(info, callback);
      return true;
    case 'removeGroupManagerDelegate':
      BizChatGroupManager.removeGroupManagerDelegate(info, callback);
      return true;
    default:
      return false;
  }
}
```

- [ ] **Step 2: Run lint on the new file state**

Run from `measured_app`:

```bash
yarn lint
```

Expected: may still fail because `Dispatch.ts` has not imported generated routes yet or because generated files expose lint issues. Fix only issues related to the new dispatch route files before continuing.

- [ ] **Step 3: Record the internal route checkpoint**

Do not commit. Continue to updating `Dispatch.ts`.

## Task 4: Wire `Dispatch.ts` To Generated Routes

**Files:**
- Modify: `measured_app/src/Dispatch.ts`

- [ ] **Step 1: Replace direct `Biz*` imports**

Remove these imports from `measured_app/src/Dispatch.ts`:

```typescript
import {BizChatClient} from './biz/BizChatClient';
import {BizChatContactManager} from './biz/BizChatContactManager';
import {BizChatGroupManager} from './biz/BizChatGroupManager';
import {BizChatManager} from './biz/BizChatManager';
import {BizChatPresenceManager} from './biz/BizChatPresenceManager';
import {BizChatPushManager} from './biz/BizChatPushManager';
import {BizChatRoomManager} from './biz/BizChatRoomManager';
import {BizChatUserInfoManager} from './biz/BizChatUserInfoManager';
```

Add this import:

```typescript
import {
  dispatchChatClient,
  dispatchChatContactManager,
  dispatchChatGroupManager,
  dispatchChatManager,
  dispatchChatPresenceManager,
  dispatchChatPushManager,
  dispatchChatRoomManager,
  dispatchChatUserInfoManager,
  dispatchInternal,
} from './dispatch';
```

- [ ] **Step 2: Replace the `dispatch` method body**

Replace the current `dispatch(data, callback)` method body in `measured_app/src/Dispatch.ts` with:

```typescript
  dispatch(data: any, callback: ReturnCallback): boolean {
    if (data === null || data === undefined || data === '') {
      return false;
    }

    let dataObject;
    try {
      dataObject = JSON.parse(data);
    } catch (error) {
      Logger.json.warn(`${Dispatch.TAG}: dispatch parse failed:`, data, error);
      return false;
    }

    const cmd = dataObject.cmd;
    const info = dataObject.info;
    Logger.json.log(`${Dispatch.TAG}: dispatch:`, cmd, info);

    return (
      dispatchChatClient(cmd, info, callback) ||
      dispatchChatManager(cmd, info, callback) ||
      dispatchChatGroupManager(cmd, info, callback) ||
      dispatchChatRoomManager(cmd, info, callback) ||
      dispatchChatContactManager(cmd, info, callback) ||
      dispatchChatPresenceManager(cmd, info, callback) ||
      dispatchChatPushManager(cmd, info, callback) ||
      dispatchChatUserInfoManager(cmd, info, callback) ||
      dispatchInternal(cmd, info, callback)
    );
  }
```

Keep `onMessage(data, callback)` unchanged.

- [ ] **Step 3: Run generator after wiring**

Run from `measured_app`:

```bash
yarn generate:dispatch
```

Expected: command exits `0` and generated route files remain syntactically stable.

- [ ] **Step 4: Record the Dispatch wiring checkpoint**

Do not commit. Continue to route validation.

## Task 5: Validate Generated Route Structure

**Files:**
- Inspect:
  - `measured_app/src/dispatch/*.generated.ts`
  - `measured_app/src/dispatch/index.ts`
  - `measured_app/src/dispatch/Internal.ts`
  - `measured_app/src/Dispatch.ts`

- [ ] **Step 1: Check generated files exist**

Run from repository root:

```bash
find measured_app/src/dispatch -maxdepth 1 -type f -print | sort
```

Expected output includes:

```text
measured_app/src/dispatch/ChatClient.generated.ts
measured_app/src/dispatch/ChatContactManager.generated.ts
measured_app/src/dispatch/ChatGroupManager.generated.ts
measured_app/src/dispatch/ChatManager.generated.ts
measured_app/src/dispatch/ChatPresenceManager.generated.ts
measured_app/src/dispatch/ChatPushManager.generated.ts
measured_app/src/dispatch/ChatRoomManager.generated.ts
measured_app/src/dispatch/ChatUserInfoManager.generated.ts
measured_app/src/dispatch/Internal.ts
measured_app/src/dispatch/index.ts
```

- [ ] **Step 2: Check generated files do not contain protocol exceptions**

Run from repository root:

```bash
rg "case '(init|login|addConnectionDelegate|deleteConnectionDelegate|addMultiDeviceDelegate|deleteMultiDeviceDelegate|addContactManagerDelegate|removeContactManagerDelegate|addChatManagerDelegate|removeChatManagerDelegate|addRoomManagerDelegate|removeRoomManagerDelegate|addGroupManagerDelegate|removeGroupManagerDelegate)'" measured_app/src/dispatch/*.generated.ts
```

Expected: no matches.

- [ ] **Step 3: Check protocol exceptions are isolated in `Internal.ts`**

Run from repository root:

```bash
rg "case '(init|login|addConnectionDelegate|deleteConnectionDelegate|addMultiDeviceDelegate|deleteMultiDeviceDelegate|addContactManagerDelegate|removeContactManagerDelegate|addChatManagerDelegate|removeChatManagerDelegate|addRoomManagerDelegate|removeRoomManagerDelegate|addGroupManagerDelegate|removeGroupManagerDelegate)'" measured_app/src/dispatch/Internal.ts
```

Expected: matches for each protocol/internal helper command.

- [ ] **Step 4: Check `Dispatch.ts` imports the barrel**

Run from repository root:

```bash
rg "from './dispatch'|switch \\(cmd\\)|BizChat" measured_app/src/Dispatch.ts
```

Expected:

- one import from `./dispatch`;
- no `switch (cmd)` in `Dispatch.ts`;
- no `BizChat*` imports in `Dispatch.ts`.

- [ ] **Step 5: Record the structure validation checkpoint**

Do not commit. Continue to app-level verification.

## Task 6: App-Level Verification

**Files:**
- Modify only if verification exposes real issues:
  - `measured_app/scripts/generate-dispatch-routes.js`
  - `measured_app/src/Dispatch.ts`
  - `measured_app/src/dispatch/*.ts`
  - `measured_app/package.json`

- [ ] **Step 1: Run generator**

Run from `measured_app`:

```bash
yarn generate:dispatch
```

Expected: command exits `0`, reports generated route counts, reports missing wrappers when present, and reports deprecated skipped methods when present.

- [ ] **Step 2: Run ESLint**

Run from `measured_app`:

```bash
yarn lint
```

Expected: command exits `0`.

- [ ] **Step 3: Run Jest**

Run from `measured_app`:

```bash
yarn test
```

Expected: command exits `0`.

- [ ] **Step 4: Check final worktree**

Run from repository root:

```bash
git status --short
```

Expected: changed files include the generator, package script, generated dispatch route files, `Dispatch.ts`, and the new spec/plan doc changes. Do not commit.

- [ ] **Step 5: Report final status**

Do not commit. Report:

- files changed;
- `yarn generate:dispatch` result;
- `yarn lint` result;
- `yarn test` result;
- notable generator summary items, especially missing wrappers and deprecated skips.

## Self-Review

- Spec coverage:
  - Generator script exists: Task 1.
  - One generated route file per manager: Tasks 1 and 5.
  - `index.ts` barrel export: Tasks 1 and 5.
  - `Dispatch.ts` remains handwritten protocol entry: Task 4.
  - Internal helper commands isolated: Task 3 and Task 5.
  - Missing wrappers reported, not generated: Task 1 and Task 6.
  - Deprecated SDK APIs skipped: Task 1 and Task 6.
  - No mocked route tests: Validation Strategy and Task 6.
  - `yarn generate:dispatch`, `yarn lint`, `yarn test`: Task 6.
- Placeholder scan:
  - No `TBD`, `TODO`, or incomplete placeholder steps.
- Type consistency:
  - Route functions consistently use `(cmd: string, info: any, callback: ReturnCallback): boolean`.
  - Generated manager names match the spec: `dispatchChatClient`, `dispatchChatManager`, `dispatchChatGroupManager`, `dispatchChatRoomManager`, `dispatchChatContactManager`, `dispatchChatPresenceManager`, `dispatchChatPushManager`, and `dispatchChatUserInfoManager`.
