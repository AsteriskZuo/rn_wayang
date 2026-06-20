# JMeter Top-Level Dynamic Parameters Design

## Context

`jmeter/README.md` documents scenario test plan execution with shell
environment variables mapped to JMeter properties through `-J` arguments. The
generated scenario plans under nested directories such as
`jmeter/data/chat-manager/` already read those properties with `__P(...)`.

The top-level plans in `jmeter/data/*.jmx` still keep static defaults in User
Defined Variables. This makes them less configurable than the scenario plans
when running against a different relay host, topic, app key, or account.

## Scope

Update only top-level JMeter plans directly under `jmeter/data/`:

- `jmeter/data/rn-sdk-base.jmx`
- `jmeter/data/rn-sdk-chat-client.jmx`
- `jmeter/data/rn-sdk-chat-manager.jmx`
- `jmeter/data/rn-sdk-chat-room-manager.jmx`
- `jmeter/data/rn-sdk-contact-manager.jmx`
- `jmeter/data/rn-sdk-group-manager.jmx`
- `jmeter/data/rn-sdk-presence-manager.jmx`
- `jmeter/data/rn-sdk-push-manager.jmx`
- `jmeter/data/rn-sdk-user-info-manager.jmx`

Also update the top-level execution examples in `jmeter/README.md`.

Do not modify nested scenario plans under `jmeter/data/*/*.jmx`.

## Parameter Contract

Each top-level plan will expose exactly these seven dynamic parameters:

| Variable | JMeter value |
| --- | --- |
| `url` | `${__P(url,localhost)}` |
| `port` | `${__P(port,8083)}` |
| `timeout` | `${__P(timeout,10000)}` |
| `topic` | `${__P(topic,rn)}` |
| `appKey` | `${__P(appKey,1135220126133718#demo)}` |
| `username` | `${__P(username,asterisk001)}` |
| `password` | `${__P(password,qwerty)}` |

The `timeout` fallback will change from the current top-level default of `200`
to `10000` so it matches the scenario test plans and README examples.

No other top-level variables become dynamic as part of this change. Variables
such as `protocol`, `duration`, `delay`, `thinktime`, `threadnum`, `rampup`,
manager-specific IDs, and fixture paths stay unchanged.

## README Updates

Add the same property mapping to both top-level execution examples:

- the single-plan example using `jmeter/data/rn-sdk-chat-client.jmx`;
- the loop that runs all current top-level plans.

The examples will pass:

```sh
-Jurl="${JMETER_URL:-localhost}" \
-Jport="${JMETER_PORT:-8083}" \
-Jtimeout="${JMETER_TIMEOUT:-10000}" \
-Jtopic="${JMETER_TOPIC:-rn}" \
-JappKey="${APP_KEY:-1135220126133718#demo}" \
-Jusername="${CHAT_USERNAME:-asterisk001}" \
-Jpassword="${CHAT_PASSWORD:-qwerty}" \
```

This mirrors the existing scenario execution pattern without adding fixture
parameters to top-level plans.

## Verification

After implementation:

1. Search `jmeter/data/*.jmx` to confirm the seven target variables use the
   expected `__P(...)` values.
2. Search the same top-level files to confirm no additional parameter names were
   converted to `__P(...)` by this change.
3. Inspect `jmeter/README.md` to confirm the top-level single-plan and batch
   examples include the same seven `-J` mappings.

Running the JMeter plans is not required for this change because it is a static
configuration update and the local relay/app may not be running.
