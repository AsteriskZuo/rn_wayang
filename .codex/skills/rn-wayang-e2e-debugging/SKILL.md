---
name: rn-wayang-e2e-debugging
description: Use in the rn_wayang repository when investigating JMeter failures, WebSocket relay problems, measured_app Android/iOS runtime issues, fixture state problems, login/logout lifecycle failures, or when deciding whether an end-to-end failure is environment, test data, protocol, SDK, JMX, dispatch, RNWS, or Biz wrapper related.
---

# RN Wayang E2E Debugging

## Purpose

Use this skill to investigate failures across `forward_server`, `measured_app`,
and `jmeter`. Its job is to prevent missed evidence and premature fixes.

Do not treat a single error message as proof of a code bug. First collect enough
evidence to classify the failure as environment, test data, protocol, SDK
business result, JMX/generator, dispatch, RNWS, Biz wrapper, or native runtime.

## Start Here

1. Read `AGENTS.md` first.
2. Read only the relevant project docs:
   - `README.md` for the integrated run flow.
   - `forward_server/README.md` for relay behavior.
   - `measured_app/README.md` for app startup, launch args, and logs.
   - `jmeter/README.md` for JMeter execution and result files.
   - `jmeter/CONTRIBUTING.md` for JMX generator and fixture rules.
3. Check branch and worktree state before edits:

   ```bash
   git status --short --branch
   ```

## Investigation Order

Follow this order unless the user gives a narrower instruction.

1. **Relay**: confirm `forward_server` is running on the expected host and port,
   normally `localhost:8083`, and using the expected topic path
   `/iov/websocket/dual?topic=<topic>`.
2. **Measured app connection**: confirm Android/iOS app is running and connected
   to the same topic as JMeter. Android emulator host is usually `10.0.2.2`;
   iOS simulator host is usually `localhost` or `127.0.0.1`.
3. **Startup parameters**: confirm `relayHost`, `relayPort`, `relayTopic`,
   `autoStart`, `rawLog`, and `jsonLog` when the app was launched by adb or
   `simctl`.
4. **JMeter result**: inspect the `.jtl` first. Identify failing sample labels,
   assertion failures, response body, sampler data, elapsed time, and whether the
   failure is connection-level or response-level.
5. **JMeter log**: inspect the matching `.log` for WebSocket errors, timeouts,
   assertion script errors, missing property values, and file path issues.
6. **Native/app log**: inspect Android `adb logcat` or iOS simulator/native logs
   for `RNWS`, `ReactNativeJS`, dispatch, SDK, login/logout, and connection
   messages.
7. **Fixture state**: for fixture-backed scenarios, confirm
   `jmeter/data-fixtures/.state/accounts.env` and `relationships.env` exist and
   are fresh enough for the scenario. Mutating scenarios may require
   `yarn reset:relationships` before rerun.
8. **Code and generated artifacts**: only after the runtime path is understood,
   inspect JMX, scenario generators, `Dispatch.ts`, generated dispatch routes,
   `RNWS.ts`, and `Biz*.ts`.

## Evidence Gate

Before concluding "real code bug", collect or explicitly explain why you cannot
collect these:

- failing JMeter sample label
- response body or missing-response fact
- JMeter `.log` symptom
- measured app connection state and topic
- native/app log excerpt around the failing request
- fixture state relevant to the scenario

If any of these are missing, say what is missing and keep the conclusion
tentative.

## Useful Commands

Run commands from the repository root unless a command changes directories.

Check failure samples:

```bash
find /tmp -path '*rn-wayang*' -name '*.jtl' -print0 | xargs -0 rg -n 's="false"|<failure>true'
```

Inspect app logs on Android:

```bash
adb logcat | rg 'RNWS|ReactNativeJS|rn_wayang|ChatClient|login|logout'
```

Launch Android app with relay args:

```bash
adb shell am start -n com.rn_wayang/.MainActivity --es relayHost 10.0.2.2 --ei relayPort 8083 --es relayTopic rn --ez autoStart true --ez rawLog true --ez jsonLog true
```

Launch iOS simulator app with relay args:

```bash
xcrun simctl launch booted org.reactjs.native.example.rn-wayang --relayHost 127.0.0.1 --relayPort 8083 --relayTopic rn --autoStart true --rawLog true --jsonLog true
```

Reset fixture relationships when scenario state may be stale:

```bash
cd jmeter/data-fixtures
yarn reset:relationships
```

## Failure Classification

- `WebSocket I/O error`, timeout, or missing response: first suspect relay not
  running, app not connected, topic mismatch, wrong host, stale app session, or
  too-short timeout.
- `protocol_error`: inspect request JSON, `cmd`, generated route name, and
  `Dispatch.ts`/route registration.
- `{ok:true,value:...}` with SDK error: the request reached the app. Inspect
  `value` for SDK code/description and check account/session/fixture state
  before changing code.
- `PRECONDITION_FAILED`: inspect fixture files, scenario setup samplers, and
  earlier samples that should have discovered ids or relationships.
- Login failure or "already logged in": check for duplicate login samplers,
  missing/failed logout, unawaited logout response, SDK session retained by the
  running app, and whether a force-stop/relaunch is needed to isolate state.
- JSR223/script failure: inspect JMeter log and generator output before
  changing measured app code.
- Native crash or startup failure: inspect native build/runtime logs; JS tests
  do not validate native SDK integration.

## Fix Discipline

- Prefer fixing the layer indicated by evidence, not the first layer that is
  easy to edit.
- Generated JMX under `jmeter/data/*-manager/` must be changed through its
  generator.
- Generated dispatch files under `measured_app/src/dispatch/*.generated.ts` must
  be changed through Biz wrappers or `scripts/generate-dispatch-routes.js`.
- If the issue is environment or stale fixture state, report the reset/restart
  needed instead of patching source.
- When a fix is made, rerun the narrow failing scenario and summarize the exact
  evidence before and after the fix.
