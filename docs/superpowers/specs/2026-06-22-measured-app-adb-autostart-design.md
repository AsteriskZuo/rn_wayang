# Measured App ADB Autostart Design

## Goal

Make `measured_app` test setup deterministic for JMeter and adb-driven runs while
preserving the existing manual UI workflow.

The app should be configurable at Android launch time, optionally connect to the
relay automatically, expose a small connection state in the UI, and print state
transitions for debugging.

## Non-Goals

- Do not change the relay protocol.
- Do not change JMeter request or response formats.
- Do not remove manual host/port editing from the UI.
- Do not add a broad connection state machine beyond the three states below.

## Launch Parameters

The Android app should support intent extras from adb:

```sh
adb shell am start \
  -n com.rn_wayang/.MainActivity \
  --es relayHost 10.0.2.2 \
  --ei relayPort 8083 \
  --es relayTopic rn \
  --ez autoStart true \
  --ez rawLog true \
  --ez jsonLog true
```

Supported extras:

- `relayHost`: relay host shown in the UI and used by `RNWS`.
- `relayPort`: relay port shown in the UI and used by `RNWS`.
- `relayTopic`: relay topic shown in the UI and used by `RNWS`.
- `autoStart`: when true, the app starts the relay WebSocket after launch.
- `rawLog`: initial value for `Logger.raw`.
- `jsonLog`: initial value for `Logger.json`.

If an extra is absent or invalid, use the current manual defaults:

- host: `localhost`
- port: `8083`
- topic: `rn`
- autoStart: `false`
- rawLog: `false`
- jsonLog: `false`

## Android to React Native Data Flow

Use Android intent extras rather than adb UI automation.

`MainActivity` should pass the supported extras into React Native initial props.
`App.tsx` reads those props during initial render, initializes its UI state from
them, sets the logger channels, configures `RNWS`, and runs auto-start when
requested.

The manual UI should remain the same source of truth after launch. If the user
edits host, port, or topic in the UI, subsequent manual starts should use the UI
values.

## Connection State

Use exactly three UI-facing states:

```ts
type ConnectionState = 'stopped' | 'starting' | 'started';
```

State meanings:

- `stopped`: no active relay connection, or the last start attempt ended.
- `starting`: `RNWS.start()` has created a WebSocket and is waiting for `onopen`.
- `started`: WebSocket `onopen` fired and the app can receive relay commands.

Errors and close reasons are status text details, not separate states. After an
error or close, state returns to `stopped`.

## RNWS Behavior

`RNWS` should expose a small status callback API so the UI can react to state
changes without parsing logs.

Expected behavior:

- `start()` closes any existing socket before creating a replacement.
- `start()` transitions to `starting`.
- WebSocket `onopen` transitions to `started`.
- WebSocket `onerror` records the error message and transitions to `stopped`.
- WebSocket `onclose` records the close code/reason when useful and transitions
  to `stopped`.
- `stop()` closes the socket, clears the socket reference, and transitions to
  `stopped`.

State transitions should be logged, for example:

```text
RNWS: state: stopped -> starting
RNWS: state: starting -> started
RNWS: state: started -> stopped
```

These state logs should be emitted through the raw logger channel so they can be
enabled by `rawLog=true` or the UI log toggle.

## UI Behavior

Keep manual operation available, but replace separate START and STOP buttons with
one state-aware button.

Button labels:

- `stopped`: `START`
- `starting`: `STARTING...`
- `started`: `STOP`

Button behavior:

- In `stopped`, clicking starts the relay connection using current UI values.
- In `starting`, clicking is disabled.
- In `started`, clicking stops the relay connection.

Show compact status text near the connection controls:

```text
Status: stopped
Status: starting ws://10.0.2.2:8083/iov/websocket/dual?topic=rn
Status: started ws://10.0.2.2:8083/iov/websocket/dual?topic=rn
Status: stopped: <last error or close reason>
```

Add `relayTopic` as a UI-editable field so adb and manual operation share the
same configurable connection address.

## Logging Controls

Keep both log channels:

- raw log
- JSON log

Initial values may come from adb extras. The UI toggles should continue to work
after launch and should reflect the current enabled state.

When `rawLog=true` or `jsonLog=true` is provided by adb, the corresponding UI
button should show the enabled state.

## Test and Verification Plan

Unit tests:

- `RNWS.start()` closes a previous socket before replacing it.
- `RNWS` emits `stopped -> starting -> started` for a successful connection.
- `RNWS` emits `starting -> stopped` for an error.
- `RNWS.stop()` emits `started -> stopped` and clears the socket reference.
- `App` initializes host, port, topic, auto-start, and logger toggles from props.

Manual/adb verification:

```sh
adb shell am force-stop com.rn_wayang
adb shell am start \
  -n com.rn_wayang/.MainActivity \
  --es relayHost 10.0.2.2 \
  --ei relayPort 8083 \
  --es relayTopic rn \
  --ez autoStart true \
  --ez rawLog true \
  --ez jsonLog true
```

Expected:

- UI shows host `10.0.2.2`, port `8083`, topic `rn`.
- UI status reaches `started`.
- logcat includes the state transition prints.
- JMeter user-info-manager scenarios can run without manual UI clicks.

Regression verification:

```sh
cd measured_app
yarn lint
yarn test --watchman=false
```

Then run:

```sh
rm -rf /tmp/rn-wayang-user-info-manager-scenarios
mkdir -p /tmp/rn-wayang-user-info-manager-scenarios
for f in jmeter/data/user-info-manager/*.jmx; do
  name=$(basename "$f" .jmx)
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/rn-wayang-user-info-manager-scenarios/${name}.jtl" \
    -j "/tmp/rn-wayang-user-info-manager-scenarios/${name}.log" \
    -Jurl="${JMETER_URL:-localhost}" \
    -Jport="${JMETER_PORT:-8083}" \
    -Jtimeout="${JMETER_TIMEOUT:-10000}" \
    -Jtopic="${JMETER_TOPIC:-rn}" \
    -JaccountsEnvPath="${USER_INFO_ACCOUNTS_ENV_PATH:-jmeter/data-fixtures/.state/accounts.env}" \
    -JrelationshipsEnvPath="${USER_INFO_RELATIONSHIPS_ENV_PATH:-jmeter/data-fixtures/.state/relationships.env}" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

Expected:

- All user-info-manager plans report `Err: 0 (0.00%)`.
- JTL files contain no failed samples.
- No `The user is already logged in` response appears.
