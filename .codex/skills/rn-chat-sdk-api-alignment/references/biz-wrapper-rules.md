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

## Audit Pipeline Inputs

`yarn audit:chat-sdk-api` runs a read-only pipeline. The producer scripts emit
JSONL records to the final audit script:

- `collect-protocol-routes.js` emits protocol/internal route records from
  `src/dispatch/Internal.ts`.
- `detect-legacy-alias-candidates.js` emits heuristic legacy alias candidate
  records from SDK and Biz method names, plus wrapper-call records when an
  existing wrapper method name differs from the active SDK method it calls.

The final audit script has built-in defaults for protocol helpers and known
legacy aliases only as a fallback for direct execution. Pipeline input is the
actual value during normal audits.

Treat wrapper-call records as review inputs. They may reveal an intentional
legacy wrapper name, or they may reveal a wrapper implementation bug. Do not
blindly rename wrappers based only on this section.

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
