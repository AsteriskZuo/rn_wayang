# RN Chat SDK API Alignment Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-local Codex skill that audits `react-native-chat-sdk` API alignment against handwritten `Biz*` wrappers and guides future iterative wrapper work.

**Architecture:** Add a repository-managed skill under `.codex/skills/rn-chat-sdk-api-alignment/`. The skill owns workflow instructions and a read-only Node.js audit script that parses SDK declarations, Biz wrappers, and generated dispatch route files with the TypeScript compiler API. `measured_app/package.json` gets a convenience script so future workers can run the audit from the app project.

**Tech Stack:** Codex skills, Node.js, TypeScript compiler API, Yarn 4, existing React Native Jest and ESLint checks.

---

## Execution Rule

Do not create per-task commits while executing this plan. Complete implementation and validation first, then report changed files and verification results so the user can decide whether and how to commit.

## File Structure

- Create `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md`
  - Project-local workflow for SDK/Biz alignment.
  - Triggers on Chat SDK API alignment, missing Biz wrappers, wrapper audits, SDK upgrades, and generated dispatch coverage reviews.
- Create `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`
  - Detailed project-specific wrapper rules and review checklist.
- Create `.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js`
  - Read-only audit script.
  - Parses SDK `.d.ts`, `Biz*` source files, and generated dispatch files.
  - Reports missing active wrappers, deprecated wrappers, `login` exception, possible legacy wrappers, and route coverage.
- Modify `measured_app/package.json`
  - Add `"audit:chat-sdk-api": "node ../.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js"`.

## Validation Strategy

This task creates project tooling and a Codex skill, not runtime app behavior. Validation is:

- direct audit script execution;
- package script execution;
- generated dispatch refresh remains stable;
- ESLint passes;
- Jest smoke test passes;
- skill file metadata and references are readable.

Run from `measured_app`:

```bash
yarn audit:chat-sdk-api
yarn generate:dispatch
yarn lint
yarn test
```

Jest may require elevated permissions because Watchman can be blocked by sandboxed socket access.

## Task 1: Create Skill Instructions

**Files:**
- Create: `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md`

- [ ] **Step 1: Create the skill directory**

Run from repository root:

```bash
mkdir -p .codex/skills/rn-chat-sdk-api-alignment/scripts .codex/skills/rn-chat-sdk-api-alignment/references
```

Expected: command exits `0`.

- [ ] **Step 2: Write `SKILL.md`**

Create `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md` with this content:

```markdown
---
name: rn-chat-sdk-api-alignment
description: Use when working in this repository on react-native-chat-sdk API alignment, missing Biz wrappers, SDK declaration drift, generated dispatch route coverage, or iterative additions to measured_app/src/biz. Runs a project-specific audit and guides manual or AI-assisted wrapper implementation with human review.
---

# RN Chat SDK API Alignment

## Purpose

Use this skill in `rn_wayang` when aligning `measured_app/src/biz/Biz*.ts`
wrappers with the local `react-native-chat-sdk` TypeScript declarations.

The task is iterative. The audit script reports facts; wrapper implementation
is still manual or AI-assisted and must be reviewed.

## Project Boundaries

- SDK declarations: `measured_app/node_modules/react-native-chat-sdk/lib/typescript/src/*.d.ts`
- Biz wrappers: `measured_app/src/biz/Biz*.ts`
- Generated dispatch routes: `measured_app/src/dispatch/*.generated.ts`
- Dispatch generator: `measured_app/scripts/generate-dispatch-routes.js`

Only active public SDK methods that return `Promise<...>` are normal coverage
targets. Deprecated SDK APIs are not normal coverage targets.

`ChatClient.login` is a deliberate deprecated exception for test setup. Keep it
in `src/dispatch/Internal.ts`; do not count it as active SDK coverage.

## Workflow

1. Read `references/biz-wrapper-rules.md`.
2. Run the audit:

   ```bash
   cd measured_app
   yarn audit:chat-sdk-api
   ```

3. Review these report sections:
   - `missing active wrappers`
   - `deprecated wrappers present`
   - `deprecated protocol exceptions`
   - `possible legacy wrappers`
   - `generated dispatch coverage`
4. If implementing wrappers, edit `measured_app/src/biz/Biz*.ts` manually.
5. Use SDK method names for active SDK wrappers.
6. Do not add old command aliases to generated SDK routes.
7. Rerun:

   ```bash
   cd measured_app
   yarn generate:dispatch
   ```

8. Review generated route diffs before finishing.
9. Run:

   ```bash
   cd measured_app
   yarn audit:chat-sdk-api
   yarn lint
   yarn test
   ```

## Implementation Rules

- Do not generate `Biz*` wrapper implementations.
- Use `BizBase.tryCatch(promise, callback, '<sdkMethodName>')`.
- Keep listener and delegate helpers outside generated SDK coverage.
- Human-review wrappers that map multiple parameters, enum-like values, message
  objects, group/room options, push options, presence payloads, or historical
  `info` field aliases.
- Report risky mappings before claiming completion.

## Audit Script

Run directly if the package script is unavailable:

```bash
node .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
```

The script is read-only. It must not modify source files, generated files,
docs, or package metadata.

## Completion Checklist

- `yarn audit:chat-sdk-api` exits `0`.
- `yarn generate:dispatch` exits `0`.
- Generated route diffs are reviewed.
- `yarn lint` exits `0`.
- `yarn test` exits `0`.
- Missing wrappers and deprecated wrappers are summarized for the user.
```

- [ ] **Step 3: Inspect the skill frontmatter**

Run from repository root:

```bash
sed -n '1,40p' .codex/skills/rn-chat-sdk-api-alignment/SKILL.md
```

Expected:

- frontmatter contains `name: rn-chat-sdk-api-alignment`;
- description mentions API alignment, missing Biz wrappers, SDK declaration drift, generated dispatch coverage, and `measured_app/src/biz`.

## Task 2: Add Biz Wrapper Rules Reference

**Files:**
- Create: `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`

- [ ] **Step 1: Write the reference file**

Create `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md` with this content:

```markdown
# Biz Wrapper Rules

## Coverage Target

Normal SDK coverage includes public methods declared on these SDK classes:

- `ChatClient`
- `ChatManager`
- `ChatGroupManager`
- `ChatRoomManager`
- `ChatContactManager`
- `ChatPresenceManager`
- `ChatPushManager`
- `ChatUserInfoManager`

The method must return `Promise<...>` and must not be marked `@deprecated`.

## Deprecated APIs

Deprecated SDK APIs are skipped for normal coverage. Do not add new missing
wrappers for deprecated APIs.

`ChatClient.login` is the only deprecated setup exception. It stays routed
through `src/dispatch/Internal.ts` for username/password JMeter setup and is not
counted as active SDK coverage.

## Wrapper Naming

Active SDK wrapper names should match SDK method names exactly.

Old command names can remain temporarily only when they are internal helpers or
when cleanup is explicitly deferred. They should be treated as legacy candidates
instead of aligned SDK coverage.

## Wrapper Pattern

Wrappers should follow the local thin wrapper style:

```typescript
static sdkMethodName(info: any, callback: ReturnCallback): void {
  const field = info.field;
  BizBase.tryCatch(
    ChatClient.getInstance().manager.sdkMethodName(field),
    callback,
    'sdkMethodName',
  );
}
```

Use the actual manager access pattern already present in the matching `Biz*`
file. Do not invent a new abstraction unless it removes real duplication in the
file being edited.

## Review Required

Human review is required when a wrapper:

- passes multiple positional SDK parameters;
- constructs messages, group options, room options, push options, or user-info objects;
- maps enum-like values;
- supports historical `info` field aliases;
- replaces an old command name with a new SDK method name;
- returns data that may need callback formatting.

Before finishing wrapper work, summarize every risky mapping and the SDK method
signature it was based on.

## Validation

After wrapper changes:

```bash
cd measured_app
yarn generate:dispatch
yarn audit:chat-sdk-api
yarn lint
yarn test
```
```

- [ ] **Step 2: Confirm the reference is discoverable from `SKILL.md`**

Run from repository root:

```bash
rg "references/biz-wrapper-rules.md" .codex/skills/rn-chat-sdk-api-alignment/SKILL.md
```

Expected: one match.

## Task 3: Add Read-Only Audit Script

**Files:**
- Create: `.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js`

- [ ] **Step 1: Write the audit script**

Create `.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js` with this content:

```javascript
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

const DEPRECATED_PROTOCOL_EXCEPTIONS = new Map([
  ['ChatClient.login', 'username/password JMeter setup command in src/dispatch/Internal.ts'],
]);

const PROTOCOL_HELPERS = new Set([
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

const LEGACY_METHOD_HINTS = [
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
        routes.push(`${manager.sdkClass}.${expression.text}`);
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

function main() {
  const activeSdk = [];
  const deprecatedSdk = [];
  const bizMethods = [];
  const generatedRoutes = [];
  const missingActiveWrappers = [];
  const deprecatedWrappers = [];

  for (const manager of MANAGERS) {
    const sdkMethods = collectSdkMethods(manager);
    const managerBizMethods = collectBizMethods(manager);
    const managerGeneratedRoutes = collectGeneratedRoutes(manager);
    const managerBizSet = new Set(managerBizMethods);

    activeSdk.push(...sdkMethods.active);
    deprecatedSdk.push(...sdkMethods.deprecated);
    bizMethods.push(...managerBizMethods);
    generatedRoutes.push(...managerGeneratedRoutes);

    for (const sdkMethod of sdkMethods.active) {
      const bizMethod = sdkToBizMethod(manager, sdkMethod);
      if (!managerBizSet.has(bizMethod)) {
        missingActiveWrappers.push(sdkMethod);
      }
    }

    for (const sdkMethod of sdkMethods.deprecated) {
      const bizMethod = sdkToBizMethod(manager, sdkMethod);
      if (managerBizSet.has(bizMethod)) {
        deprecatedWrappers.push(sdkMethod);
      }
    }
  }

  const activeSdkSet = new Set(activeSdk);
  const generatedRouteSet = new Set(generatedRoutes);
  const routedActive = activeSdk.filter(method => generatedRouteSet.has(method));
  const activeWrappersNotRouted = activeSdk.filter(
    method => !generatedRouteSet.has(method) && !missingActiveWrappers.includes(method),
  );
  const routeWithoutActiveSdk = generatedRoutes.filter(
    route => !activeSdkSet.has(route) && !PROTOCOL_HELPERS.has(route.split('.').at(-1)),
  );
  const possibleLegacyWrappers = LEGACY_METHOD_HINTS.filter(([legacy, target]) => {
    return bizMethods.includes(legacy) && activeSdkSet.has(target);
  }).map(([legacy, target]) => `${legacy} may map to ${target}`);

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
    [...DEPRECATED_PROTOCOL_EXCEPTIONS.entries()].map(
      ([method, reason]) => `${method} - ${reason}`,
    ),
  );
  printSection(
    'possible legacy wrappers',
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
```

- [ ] **Step 2: Make the script executable**

Run from repository root:

```bash
chmod +x .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
```

Expected: command exits `0`.

- [ ] **Step 3: Run the script directly**

Run from repository root:

```bash
node .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
```

Expected:

- command exits `0`;
- output starts with `chat sdk api alignment audit`;
- output includes `missing active wrappers:`;
- output includes `deprecated protocol exceptions:`;
- output includes `ChatClient.login - username/password JMeter setup command in src/dispatch/Internal.ts`;
- output includes `generated dispatch coverage:`.

## Task 4: Add Package Script

**Files:**
- Modify: `measured_app/package.json`

- [ ] **Step 1: Add `audit:chat-sdk-api`**

Update `measured_app/package.json` so the `scripts` block contains:

```json
"scripts": {
  "android": "react-native run-android",
  "ios": "react-native run-ios",
  "lint": "eslint .",
  "start": "react-native start",
  "test": "jest",
  "generate:dispatch": "node scripts/generate-dispatch-routes.js",
  "audit:chat-sdk-api": "node ../.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js"
}
```

Keep the rest of `package.json` unchanged.

- [ ] **Step 2: Run the package script**

Run from `measured_app`:

```bash
yarn audit:chat-sdk-api
```

Expected: same report shape as the direct script run, exit `0`.

## Task 5: Validate Skill Usability

**Files:**
- Inspect:
  - `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md`
  - `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`
  - `.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js`

- [ ] **Step 1: Verify skill files exist**

Run from repository root:

```bash
find .codex/skills/rn-chat-sdk-api-alignment -maxdepth 3 -type f -print | sort
```

Expected output:

```text
.codex/skills/rn-chat-sdk-api-alignment/SKILL.md
.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md
.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
```

- [ ] **Step 2: Verify project-specific rule coverage**

Run from repository root:

```bash
rg "ChatClient.login|deprecated|active SDK|yarn audit:chat-sdk-api|human review|BizBase.tryCatch" .codex/skills/rn-chat-sdk-api-alignment
```

Expected:

- matches in `SKILL.md`;
- matches in `references/biz-wrapper-rules.md`;
- `ChatClient.login` appears as a deprecated setup exception.

- [ ] **Step 3: Verify the audit script is read-only by inspection**

Run from repository root:

```bash
rg "writeFile|appendFile|rmSync|unlinkSync|mkdirSync|renameSync|copyFileSync" .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js
```

Expected: no matches.

## Task 6: App-Level Verification

**Files:**
- Modify only if verification exposes issues:
  - `.codex/skills/rn-chat-sdk-api-alignment/SKILL.md`
  - `.codex/skills/rn-chat-sdk-api-alignment/references/biz-wrapper-rules.md`
  - `.codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js`
  - `measured_app/package.json`

- [ ] **Step 1: Run the audit package script**

Run from `measured_app`:

```bash
yarn audit:chat-sdk-api
```

Expected:

- exits `0`;
- prints active SDK API count;
- prints missing wrappers;
- prints deprecated wrappers;
- prints `ChatClient.login` under deprecated protocol exceptions;
- prints generated dispatch coverage.

- [ ] **Step 2: Run the dispatch generator**

Run from `measured_app`:

```bash
yarn generate:dispatch
```

Expected: exits `0` and generated route files remain stable.

- [ ] **Step 3: Run ESLint**

Run from `measured_app`:

```bash
yarn lint
```

Expected: exits `0`.

- [ ] **Step 4: Run Jest**

Run from `measured_app`:

```bash
yarn test
```

Expected:

- exits `0`;
- `__tests__/App.test.tsx` passes.

If Watchman socket access fails with `Operation not permitted`, rerun the same command with escalated permissions. Do not change test code for a Watchman sandbox failure.

- [ ] **Step 5: Check final worktree**

Run from repository root:

```bash
git status --short
```

Expected changed files:

```text
 M measured_app/package.json
?? .codex/skills/rn-chat-sdk-api-alignment/
```

There may also be the implementation plan document if it has not been committed separately.

## Self-Review

- Spec coverage:
  - Project-local skill path: Task 1 and Task 5.
  - Read-only audit script: Task 3 and Task 5.
  - Active SDK API extraction: Task 3.
  - Deprecated SDK reporting: Task 3.
  - `login` exception: Task 1, Task 2, and Task 3.
  - Possible legacy wrappers: Task 3.
  - Generated dispatch coverage: Task 3.
  - Package script: Task 4.
  - Validation commands: Task 6.
- Placeholder scan:
  - No `TBD`, `TODO`, or incomplete implementation steps.
  - Example output placeholders are limited to expected variable counts and are not implementation gaps.
- Type consistency:
  - Skill path is consistently `.codex/skills/rn-chat-sdk-api-alignment`.
  - Package script is consistently `audit:chat-sdk-api`.
  - Audit script name is consistently `audit-chat-sdk-api-alignment.js`.
