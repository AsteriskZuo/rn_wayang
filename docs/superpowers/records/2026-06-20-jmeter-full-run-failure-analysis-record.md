# JMeter Full Run Failure Analysis Record

## Context

This record captures the JMeter validation run performed on 2026-06-20 after
`forward_server` and `measured_app` were already running.

The goal was to reset fixture data, execute the documented JMeter suites, list
all failing cases, and separate expected environment/service failures from
possible test or product issues.

## Execution Notes

Fixture relationships were reset successfully with:

```sh
cd jmeter/data-fixtures
yarn reset:relationships
```

The final reset generated:

```text
GROUP_ID=317268932231170
ROOM_ID=317268932231171
```

An initial all-in-one run produced misleading failures because the top-level
plan properties `-Jusername` and `-Jpassword` were also passed to fixture-based
scenario plans. That overrode the scenario defaults that should come from
`accounts.env` and `relationships.env`, causing false failures such as
"User has not joined the group" and missing contact/user fixture data.

After resetting relationships again, the suites were rerun using the parameter
sets documented in `jmeter/README.md`:

- top-level `jmeter/data/*.jmx` plans received `appKey`, `username`, and
  `password`;
- ChatManager scenarios received `appKey`, `username`, and `password`;
- ContactManager, GroupManager, ChatRoomManager, and UserInfoManager scenarios
  used their fixture env paths and did not receive top-level
  `username/password` overrides.

Final result directory:

```text
/tmp/rn-wayang-jmeter-scan-20260620-1533
```

## Final Summary

The final run produced 41 JTL files.

- 30 plans passed.
- 11 plans had one failing sample each.
- All 9 top-level plans under `jmeter/data/*.jmx` passed.
- All ContactManager scenario plans passed.

## Failing Cases

| Classification | Plan | Failing sample | Evidence |
| --- | --- | --- | --- |
| Service not enabled | `message-reaction` | `ChatManager.addReaction` | `code=505`, `this appKey is not open reaction service!` |
| Service not enabled | `message-target-types` | `Chat thread - ChatManager.createChatThread` | `code=305`, `thread not open.` |
| Service not enabled | `message-thread-management` | `ChatManager.createChatThread` | `code=305`, `thread not open.` |
| Likely service/config capability | `message-translation` | `Fetch supported translation languages` | `code=303`, `Unknown server error` |
| Possible real issue | `message-query` | `查询会话消息` | `ChatManager.getMsgs` returned `code=1`, `description=null` |
| Possible real issue | `message-recall-delete` | `按 ID 服务端删除后拉取历史消息` | `ChatManager.fetchHistoryMessagesByOptions` returned `code=1`, `description=null` |
| Possible permission/service limitation | `chat-room-attributes-lifecycle` | `设置聊天室属性` | `ChatRoomManager.addAttributes` returned `code=1`, `description=null` |
| Possible permission/service limitation | `chat-room-create-destroy-lifecycle` | `创建临时聊天室` | `code=703`, `you have no permission to do this.` |
| Likely test-case precondition issue | `chat-room-moderation-lifecycle` | `拉黑非成员` | `code=703`, `users [wayang_demo_016] are not members of this group!` |
| Likely test-case precondition issue | `group-moderation-lifecycle` | `拉黑非成员` | `code=603`, `users [wayang_demo_011] are not members of this group!` |
| Needs original response capture | `user-info-batch-query` | `按 ID 批量查询 fixture 用户信息` | `PRECONDITION_FAILED: user-info-batch-query expected chatPeerUserId to appear in response` |

## Initial Classification

The following failures match optional service or app capability requirements
already described in `jmeter/README.md`:

- `message-reaction`: reaction service is not enabled for the app key.
- `message-target-types` and `message-thread-management`: chat thread support
  is not enabled for the app key.
- `message-translation`: translation support is likely unavailable or
  misconfigured. The SDK returned `code=303` with `Unknown server error`, so it
  should be discussed as a service/config capability issue first.

The following failures look like test-case or precondition issues:

- `group-moderation-lifecycle` tries to block `wayang_demo_011`, which is
  explicitly the non-member fixture. The server rejects it because the user is
  not a member.
- `chat-room-moderation-lifecycle` similarly tries to block
  `wayang_demo_016`, which is explicitly the chat-room non-member fixture.
- If the SDK requires block targets to already be group/chat-room members, these
  test cases should first add the target as a member, or should be rewritten as
  negative-path assertions.

The following need deeper investigation before proposing fixes:

- `message-query`: `ChatManager.getMsgs` returns `code=1` with no description
  after earlier message send and message-id lookup steps pass.
- `message-recall-delete`: `ChatManager.fetchHistoryMessagesByOptions` returns
  `code=1` with no description after `removeMessagesFromServerWithMsgIds`
  succeeds.
- `chat-room-attributes-lifecycle`: `ChatRoomManager.addAttributes` returns
  `code=1` with no description while running as the fixture room owner.
- `chat-room-create-destroy-lifecycle`: `ChatRoomManager.createChatRoom`
  returns `code=703`, which suggests the current account/app may not have
  permission to create rooms from the SDK.
- `user-info-batch-query`: the JMeter precondition script overwrote the raw SDK
  response with `PRECONDITION_FAILED`, so the next investigation should preserve
  or log the original response before classifying this as SDK behavior,
  fixture-data absence, or assertion-shape mismatch.

## Verification Notes

The sandboxed JMeter run cannot be used for business failure analysis because
local WebSocket connections to `ws://localhost:8083/iov/websocket/dual?topic=rn`
failed with:

```text
WebSocket I/O error: Operation not permitted
```

The final results above come from the rerun that was allowed to connect to the
local relay outside the sandbox.

## Follow-up Classification

The following failures were confirmed by the user as external capability or
paid/control-panel service requirements and are not product/test bugs for the
current pass:

- `ChatManager.addReaction`
- `Chat thread - ChatManager.createChatThread`
- `ChatManager.createChatThread`
- `Fetch supported translation languages`
- `创建临时聊天室`

The two `拉黑非成员` cases were confirmed as invalid for the current scenario
suite. The suite currently contains positive scenarios: valid operations with
expected successful results. Blocking a non-member is a valid negative or
error-path scenario, but it should live in a separate negative scenario suite
instead of the current positive moderation lifecycle tests.

## Stage 1 Fixes

Stage 1 fixed confirmed issues only:

- `ChatUserInfoManager.fetchUserInfoById` now converts SDK `Map` results to a
  plain object before returning through the WebSocket response path. This fixes
  `user-info-batch-query`, where the response previously lost the map entries
  during JSON serialization.
- `group-moderation-lifecycle` now blocks `groupMemberUserId1` instead of
  `groupNonMemberUserId1`.
- `chat-room-moderation-lifecycle` now blocks `roomMemberUserId1` instead of
  `roomNonMemberUserId1`.

Updated files:

- `measured_app/src/biz/BizChatUserInfoManager.ts`
- `measured_app/__tests__/BizChatManager.response.test.ts`
- `jmeter/tools/group_manager_scenarios/generate.js`
- `jmeter/tools/group_manager_scenarios/generate.test.js`
- `jmeter/tools/chat_room_manager_scenarios/generate.js`
- `jmeter/tools/chat_room_manager_scenarios/generate.test.js`
- regenerated `jmeter/data/group-manager/group-moderation-lifecycle.jmx`
- regenerated `jmeter/data/chat-room-manager/chat-room-moderation-lifecycle.jmx`

Stage 1 verification performed:

```sh
node --test jmeter/tools/group_manager_scenarios/generate.test.js
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
cd measured_app
yarn test __tests__/BizChatManager.response.test.ts --watchman=false
```

The targeted JMeter validation was also rerun after resetting relationships.
The reset generated:

```text
GROUP_ID=317300216496129
ROOM_ID=317300216496130
```

These plans passed with `Err: 0`:

- `jmeter/data/group-manager/group-moderation-lifecycle.jmx`
- `jmeter/data/chat-room-manager/chat-room-moderation-lifecycle.jmx`
- `jmeter/data/user-info-manager/user-info-batch-query.jmx`

Result directory:

```text
/tmp/rn-wayang-jmeter-stage1-20260621-0751
```

## Stage 2 Android Log Investigation

After Stage 1 passed, Android logs were collected with `adb logcat` while
rerunning the remaining uncertain failing scenarios. The sandboxed `adb`
command could not start the local smartsocket listener, so `adb` was run with
approval outside the sandbox.

The fixture reset for Stage 2 generated:

```text
GROUP_ID=317300329742337
ROOM_ID=317300329742339
```

Rerun result directory:

```text
/tmp/rn-wayang-jmeter-stage2-20260621-0752
```

The remaining uncertain failures were confirmed from native-side logs:

| Plan | API | Log evidence | Current root-cause conclusion |
| --- | --- | --- | --- |
| `message-query` | `ChatManager.getMsgs` | `EMWrapper onError: org.json.JSONException: No value for startId` | The wrapper/test input does not provide `startMsgId`; the native method requires `startId`. |
| `message-recall-delete` | `ChatManager.fetchHistoryMessagesByOptions` | `EMWrapper onError: org.json.JSONException: No value for direction` | The test sends `options: {}`; native requires at least `direction` and likely a complete `ChatFetchMessageOptions` shape. |
| `chat-room-attributes-lifecycle` | `ChatRoomManager.addAttributes` | `attributes of type JSONObject cannot be converted to JSONArray` | The test/wrapper passes attributes as a single object; native expects a JSON array/object-array shape. |

No fixes were made for these three Stage 2 findings. They should be discussed
and approved before changing either the wrappers or JMeter inputs.

## Stage 2 Fixes

After the Android log root causes were confirmed, the remaining three issues
were fixed with the following boundary: JMeter must send valid SDK/native input;
the measured app should not invent default business/API parameters to make an
invalid test pass.

- The `message-query` JMeter scenario now sends `startMsgId: ""` to
  `ChatManager.getMsgs`, satisfying the native `startId` requirement shown in
  logcat.
- The ChatManager generated JMeter scenarios now send a complete
  `fetchHistoryMessagesByOptions.options` object instead of `{}`. The nested
  `direction` value is sent as the SDK enum number `0`, not the string `UP`.
- The ChatRoomManager generated JMeter scenario now sends `attributes` as the
  SDK-required array shape.
- The measured app does not add defaults for `getMsgs.startMsgId`, does not
  fill missing `fetchHistoryMessagesByOptions.options`, and does not normalize
  object-shaped `addAttributes.attributes` input. Invalid JMeter input should
  remain visible as a test-case problem.

The chat-room attributes rerun exposed one additional response-shape issue:

- `ChatRoomManager.fetchChatRoomAttributes` returns `Map<string, string>`.
  Like `fetchUserInfoById`, this must be converted to a plain object before
  returning over the WebSocket JSON response path. Without that conversion,
  JMeter receives `{}` and the attribute-value assertion fails even though the
  SDK set call succeeded.

Additional tests added:

- `BizChatManager.response.test.ts` covers forwarding caller-provided
  `getMsgs.startMsgId`, forwarding caller-provided
  `fetchHistoryMessagesByOptions.options`, and `fetchUserInfoById` `Map`
  serialization.
- `BizChatRoomManager.response.test.ts` covers forwarding caller-provided
  `addAttributes.attributes` arrays and `fetchChatRoomAttributes` `Map`
  serialization.
- ChatManager and ChatRoomManager generator tests assert the generated JMX uses
  valid option/attribute shapes.

Stage 2 fix verification:

```sh
yarn test __tests__/BizChatManager.response.test.ts --watchman=false
yarn test __tests__/BizChatRoomManager.response.test.ts --watchman=false
node --test jmeter/tools/chat_manager_scenarios/generate.test.js
node --test jmeter/tools/chat_room_manager_scenarios/generate.test.js
```

Targeted JMeter validation after the final boundary adjustment:

- `jmeter/data/chat-manager/message-query.jmx`: `Err: 0`
- `jmeter/data/chat-manager/message-recall-delete.jmx`: `Err: 0`
- `jmeter/data/chat-room-manager/chat-room-attributes-lifecycle.jmx`: `Err: 0`

Result directory:

```text
/tmp/rn-wayang-jmeter-stage2-fixes-20260621-0020
```
