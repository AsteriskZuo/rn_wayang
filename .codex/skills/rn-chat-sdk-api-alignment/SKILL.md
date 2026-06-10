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
   - `possible legacy or implementation mismatch wrappers`
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

The package script runs three read-only scripts as a pipeline:

```bash
cd measured_app
yarn audit:chat-sdk-api
```

- `collect-protocol-routes.js` parses `src/dispatch/Internal.ts` and emits
  protocol/internal routes.
- `detect-legacy-alias-candidates.js` parses SDK and Biz method names and emits
  heuristic legacy alias candidates. It also emits wrapper-call records when a
  wrapper method name differs from the active SDK method it currently calls.
- `audit-chat-sdk-api-alignment.js` reads those JSONL records from stdin and
  produces the final report.

The audit script keeps built-in protocol and legacy defaults as fallback values
for direct execution without `--input`. When pipeline input is provided, the
input is treated as the actual current project state and overrides those
defaults. Empty `--input -` is a real empty input and does not fall back to
defaults.

Run the same three-script flow directly if the package script is unavailable:

```bash
cd ..
tmp=${TMPDIR:-/tmp}/chat-sdk-api-audit-$$.jsonl
trap 'rm -f "$tmp"' EXIT HUP INT TERM
node .codex/skills/rn-chat-sdk-api-alignment/scripts/collect-protocol-routes.js > "$tmp" &&
  node .codex/skills/rn-chat-sdk-api-alignment/scripts/detect-legacy-alias-candidates.js >> "$tmp" &&
  node .codex/skills/rn-chat-sdk-api-alignment/scripts/audit-chat-sdk-api-alignment.js --input - < "$tmp"
```

The scripts are read-only. They must not modify source files, generated files,
docs, or package metadata.

## Completion Checklist

- `yarn audit:chat-sdk-api` exits `0`.
- `yarn generate:dispatch` exits `0`.
- Generated route diffs are reviewed.
- `yarn lint` exits `0`.
- `yarn test` exits `0`.
- Missing wrappers and deprecated wrappers are summarized for the user.
- Wrapper-call mismatch records are review inputs, not automatic rename
  instructions.
