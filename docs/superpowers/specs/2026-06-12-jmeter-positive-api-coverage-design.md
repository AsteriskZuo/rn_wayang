# JMeter Positive API Coverage Design

## Context

`measured_app` now exposes the completed `react-native-chat-sdk` API surface
through generated dispatch routes. The existing JMeter plans under
`jmeter/data/` cover only a small starter subset:

- `rn-sdk-chat-client.jmx`
- `rn-sdk-chat-manager.jmx`
- `rn-sdk-group-manager.jmx`
- `rn-sdk-base.jmx`

The next step is to expand JMeter coverage by manager so testers can drive all
supported generated routes through `forward_server` and `measured_app`.

## Goal

Add positive JMeter API coverage for all generated manager routes:

- `ChatClient`
- `ChatManager`
- `ChatGroupManager`
- `ChatRoomManager`
- `ChatContactManager`
- `ChatPresenceManager`
- `ChatPushManager`
- `ChatUserInfoManager`

Each generated API route should have one positive JMeter sampler unless a route
is explicitly documented as not practical to run in this pass.

## Non-Goals

- Do not add negative test cases in this task.
- Do not design invalid parameters, unauthenticated-state cases, permission
  failures, or server-side error cases.
- Do not add a JMX generator.
- Do not add a persistent validation script unless the implementation uncovers a
  major manual-maintenance risk and the user approves that change first.
- Do not change `measured_app`, generated dispatch routing, Biz wrappers, or SDK
  behavior to make JMeter cases pass.
- Do not change the JMeter architecture without user approval.

## Selected Approach

Use hand-edited JMX files.

The API payloads differ too much in parameter count, parameter type, required
state, and return value shape for a generator to remove the hard part. A
generator would still need a large manually maintained test-data table. Since SDK
1.15.0 API signatures are expected to remain stable after this pass, direct JMX
maintenance is acceptable for this version.

If SDK 1.16.0 adds, deprecates, or replaces APIs, the corresponding test cases
should be updated as part of that SDK upgrade.

## JMX File Layout

Keep JMX plans independent and runnable from JMeter UI or CLI.

Existing files to expand:

- `jmeter/data/rn-sdk-chat-client.jmx`
- `jmeter/data/rn-sdk-chat-manager.jmx`
- `jmeter/data/rn-sdk-group-manager.jmx`

New files to add:

- `jmeter/data/rn-sdk-chat-room-manager.jmx`
- `jmeter/data/rn-sdk-contact-manager.jmx`
- `jmeter/data/rn-sdk-presence-manager.jmx`
- `jmeter/data/rn-sdk-push-manager.jmx`
- `jmeter/data/rn-sdk-user-info-manager.jmx`

Each JMX file should keep the same high-level flow:

1. Initialize `ChatClient` and open the WebSocket connection from this sampler.
2. Log in.
3. Run manager-specific positive API samplers.
4. Log out.
5. Include the existing result listeners.

Do not keep a standalone `建立连接` sampler in any JMX file, including
`jmeter/data/rn-sdk-base.jmx`. That sampler is treated as a test case by JMeter
and can fail because it has no real command payload. Keeping it in the base
template would also cause future manager files to inherit the wrong structure.

The first real command sampler, normally `初始化`, must set
`createNewConnection` to `true` and include the WebSocket `server`, `port`,
`path`, `connectTimeout`, and `readTimeout` values that the removed standalone
connection sampler previously carried.

After `rn-sdk-base.jmx` is normalized to this structure, use it and the existing
manager JMX files as XML structure references. Preserve JMeter element/hashTree
pairing and the existing WebSocket sampler property style.

## Positive Case Semantics

A positive case means the request is expected to call the SDK successfully and
return through the measured app protocol with:

```json
{"ok": true, "value": ...}
```

The test does not need to deeply validate the returned business value in this
task. For APIs with `Promise<void>` or no business return, the normalized
response is expected to be:

```json
{"ok": true, "value": null}
```

Positive samplers are split into three coverage classes:

- **Default runnable positive coverage**: enabled by default and expected to pass
  when the common login account and normal fixture variables are valid.
- **Conditional positive coverage**: sampler exists and has the same `"ok":true`
  assertion, but is disabled by default or requires explicit tester-provided
  values/state before running. This includes destructive, state-resetting, or
  strongly environment-dependent APIs such as device kick, app identity changes,
  token renewal, RTC token requests, and account creation.
- **Limited coverage**: sampler exists and may be enabled, but the current
  measured app wrapper or SDK flow limits what `"ok":true` proves. These limits
  must be recorded in coverage documentation.

Conditional samplers count toward route presence coverage, but not toward the
default one-click runnable flow. Documentation must clearly distinguish these
states so testers do not interpret a disabled or conditional sampler as a default
passing case.

## Assertion Rule

Every positive API sampler must include a response assertion that requires the
response body to contain:

```text
"ok":true
```

This aligns JMeter's green/red result with the measured app protocol result.
Without this assertion, JMeter can show a green sampler whenever it receives a
WebSocket response, even if the response body is a protocol error such as
`invalid_json`.

Protocol errors, malformed JSON, unknown commands, `ok:false`, and SDK failures
must make the sampler fail through this assertion.

## Assertion Rollout Gate

Do not apply the assertion pattern to all manager files immediately.

Implementation must first run a small assertion pilot on
`jmeter/data/rn-sdk-chat-client.jmx`:

1. Delete the standalone `建立连接` sampler.
2. Move the WebSocket connection settings onto the `初始化` sampler.
3. Add the assertion to the small existing ChatClient command flow.
4. Verify the normal flow still passes.
5. Temporarily create a controlled failure, such as an invalid command or invalid
   request body, and verify JMeter marks the sampler red.
6. Restore the valid request.
7. Ask the user to manually verify the file in JMeter UI.

Only after the user confirms the assertion behavior should the implementation
normalize `rn-sdk-base.jmx` and apply the assertion pattern to all API samplers.

## Variable Rule

All business test data must be expressed as JMeter User Defined Variables.

Examples include:

- User IDs
- Group IDs
- Chat room IDs
- Conversation IDs
- Message IDs
- Thread IDs
- File paths
- Cursor/page parameters
- Common text values used by create/update calls

Any `${variable}` referenced by newly added or modified samplers in this task
must be declared in the same JMX file's User Defined Variables section.

The implementation does not need to add runtime guards for missing variables.
If future manual maintenance adds a sampler and forgets to declare a variable,
that is a maintenance/tester responsibility for that future change.

Variable values inserted inside JSON strings must be JSON-safe. They must not
contain unescaped double quotes, backslashes, or newlines. Variables intended to
represent JSON objects must be inserted as JSON objects, not quoted strings.

## Limited Coverage APIs

Some APIs can only prove that the SDK call was issued successfully. They cannot
prove the final business outcome from the immediate response.

Example:

```text
ChatContactManager.addContact
```

In SDK 1.15.0 this call sends a contact request and returns when the request call
finishes. The test cannot prove from the same API response that the target user
received the request, accepted it, or that the final contact relationship was
created.

For this task, such APIs should still be included as positive samplers when a
stable positive payload exists. Passing means only:

- The WebSocket command reached `measured_app`.
- The generated dispatch route called the Biz wrapper.
- The SDK call resolved.
- The measured app returned `"ok":true`.

Passing does not mean the full business state transition was verified.

Create or update a long-lived coverage document:

```text
docs/jmeter-api-coverage.md
```

That document should list:

- Manager JMX files.
- Important JMeter variables and their intended meaning.
- The positive-only coverage rule.
- Limited coverage APIs.
- Why each limited API does not verify final business state.
- Notes for future SDK 1.16.0 or later updates.

## Escalation Rules

During implementation, stop and ask the user before proceeding if any of these
conditions occur:

- The design does not cover a newly discovered issue.
- A route has no reasonable positive case.
- A route needs measured app behavior changes to pass.
- A route needs dispatch or Biz wrapper changes to pass.
- The JMX structure needs a major change.
- A generator or persistent validation script appears necessary.
- A test case would need to avoid or hide a real failure to pass.

Do not modify the test target or weaken test intent just to make JMeter green.

## Verification Strategy

Before broad implementation:

- Validate the assertion pilot with `rn-sdk-chat-client.jmx`.
- Have the user manually verify the JMeter UI behavior.

For completed JMX files:

- Confirm XML is well formed.
- Confirm each generated dispatch route in scope has a corresponding positive
  sampler or is documented as deferred/not practical.
- Confirm newly referenced JMeter variables are declared in the same file.
- Confirm positive API samplers include the `"ok":true` assertion.
- If the local environment is available, run the JMeter CLI against the relay and
  measured app and inspect the result files.

Native SDK behavior still requires the real React Native app environment. Unit
tests and lint do not prove that remote SDK calls succeed.
