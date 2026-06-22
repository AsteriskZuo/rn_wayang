# JMeter REST Test Data Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bash-based REST fixture scripts that prepare Easemob account, contact, group, and chat-room data for JMeter CLI runs without modifying existing `.jmx` plans.

**Architecture:** The fixture tool lives under `jmeter/tools/rest_fixtures/`. Low-frequency provisioning writes an ignored `users.env` account-role file, high-frequency reset commands call Easemob REST APIs and write ignored runtime state, and runner scripts source generated `jmeter-props.sh` to pass prepared values to JMeter with `-J` arguments. Implementation uses small Bash libraries for config, REST calls, state, properties, and scenario mapping.

**Tech Stack:** Bash 3.2-compatible scripts, `curl`, `jq`, Apache JMeter 5.6.3 CLI, existing `jmeter/data/*.jmx` plans.

---

## Source Spec

Implement:

```text
docs/superpowers/specs/2026-06-18-jmeter-rest-test-data-management-design.md
```

Respect the user's workflow preference: do not commit after each task. Complete the tasks, verify, then make one final commit.

## File Structure

Create:

```text
jmeter/tools/rest_fixtures/
  README.md
  config.example.env
  users.example.env
  provision-users.sh
  reset-fixtures.sh
  destroy-fixtures.sh
  run-scenario.sh
  run-suite.sh
  lib/
    config.sh
    jmeter_props.sh
    rest.sh
    scenarios.sh
    state.sh
```

Modify:

```text
.gitignore
jmeter/README.md
```

Generated and ignored at runtime:

```text
jmeter/runtime/rest-fixtures/
  users.env
  state.json
  jmeter-props.sh
  logs/
```

Responsibility split:

- `config.sh`: path defaults, option parsing helpers, required command checks, safe loading of config and users files.
- `rest.sh`: Easemob REST URL construction, authenticated request helper, and thin fixture operations.
- `state.sh`: read/write `state.json` through `jq`, validate appKey/prefix state, update group/room IDs.
- `jmeter_props.sh`: generate `JMETER_PROPS` Bash array from config, `users.env`, and `state.json`.
- `scenarios.sh`: scenario name to `.jmx` path and fixture reset mapping.
- top-level scripts: user-facing command orchestration only.

## REST Documentation Gate

Before implementing concrete REST operations, open the official Easemob server-side docs and confirm endpoint paths and request bodies for:

```text
account registration
batch account deletion
friend/contact add and delete
group create, dissolve/delete, add/remove/list members
chat room create, dissolve/delete, add/remove/list members
```

Record the confirmed docs links in `jmeter/tools/rest_fixtures/README.md`.

Do not spread raw REST paths across many scripts. Add them only in `lib/rest.sh`.

Implementation and verification are intentionally split into two phases:

1. Build and validate the script flow in dry-run mode. This phase must not
   require a real `restAppToken` and must not call live REST APIs.
2. After dry-run passes, run a separate live REST validation subtask with real
   credentials supplied by the caller immediately before execution.

---

### Task 1: Ignore Runtime Fixture Output

**Files:**

- Modify: `.gitignore`

- [ ] **Step 1: Add runtime ignore entries**

Append this block near the existing runtime/log ignore entries:

```gitignore
# JMeter REST fixture runtime data
jmeter/runtime/
```

- [ ] **Step 2: Verify ignore behavior**

Run:

```bash
mkdir -p jmeter/runtime/rest-fixtures
touch jmeter/runtime/rest-fixtures/users.env
git status --short --ignored jmeter/runtime/rest-fixtures/users.env
```

Expected: output contains:

```text
!! jmeter/runtime/rest-fixtures/users.env
```

- [ ] **Step 3: Remove the temporary runtime file**

Run:

```bash
rm -f jmeter/runtime/rest-fixtures/users.env
rmdir jmeter/runtime/rest-fixtures 2>/dev/null || true
rmdir jmeter/runtime 2>/dev/null || true
```

Expected: no output, or `rmdir` silently ignored because directories are not empty.

---

### Task 2: Add Fixture Templates And Documentation

**Files:**

- Create: `jmeter/tools/rest_fixtures/README.md`
- Create: `jmeter/tools/rest_fixtures/config.example.env`
- Create: `jmeter/tools/rest_fixtures/users.example.env`

- [ ] **Step 1: Create `config.example.env`**

Use this content:

```bash
# Copy to config.env and fill real REST values. Do not commit config.env.

url='localhost'
port='8083'
timeout='10000'
topic='rn'
appKey='easemob-demo#zuoyu'

# Default SDK login values. provision-users.sh can replace username/password
# with PRIMARY_USERNAME/PRIMARY_PASSWORD from users.env for generated runs.
username='asterisk001'
password='qwerty'

# Easemob REST configuration.
restHost='https://ngi-a1.easemob.com'
restOrgName=''
restAppName=''
restAppToken=''

# Account pool configuration.
fixturePrefix='wayang_demo'
fixturePassword='qwerty'
```

- [ ] **Step 2: Create `users.example.env`**

Use this content:

```bash
APP_KEY='easemob-demo#zuoyu'
USER_PREFIX='wayang_demo'
DEFAULT_PASSWORD='qwerty'

PRIMARY_USERNAME='wayang_demo_001'
PRIMARY_PASSWORD='qwerty'

CONTACT_FRIEND_USERNAME='wayang_demo_002'
CONTACT_NON_FRIEND_USERNAME='wayang_demo_003'
CONTACT_DELETE_USERNAME='wayang_demo_004'
CONTACT_ADD_USERNAME='wayang_demo_005'

CHAT_PEER_USERNAME='wayang_demo_006'

GROUP_OWNER_USERNAME='wayang_demo_007'
GROUP_MEMBER_USERNAME_1='wayang_demo_008'
GROUP_MEMBER_USERNAME_2='wayang_demo_009'
GROUP_NON_MEMBER_USERNAME_1='wayang_demo_010'
GROUP_NON_MEMBER_USERNAME_2='wayang_demo_011'

ROOM_OWNER_USERNAME='wayang_demo_012'
ROOM_MEMBER_USERNAME_1='wayang_demo_013'
ROOM_MEMBER_USERNAME_2='wayang_demo_014'
ROOM_NON_MEMBER_USERNAME_1='wayang_demo_015'
ROOM_NON_MEMBER_USERNAME_2='wayang_demo_016'
```

- [ ] **Step 3: Create `README.md`**

Use this content, then update the REST documentation links after confirming the exact subpages:

```markdown
# JMeter REST Fixtures

These Bash scripts prepare Easemob REST data for JMeter CLI runs. They do not
modify `.jmx` files and they do not pass REST credentials to JMeter.

## Runtime Files

Generated files are written under `jmeter/runtime/rest-fixtures/` and are
ignored by Git:

- `users.env`: stable account-role mapping for one appKey.
- `state.json`: generated group and chat room IDs.
- `jmeter-props.sh`: Bash array of `-J` arguments consumed by runner scripts.
- `logs/`: JMeter `.jtl` and `.log` files.

## Setup

```bash
cp jmeter/tools/rest_fixtures/config.example.env jmeter/tools/rest_fixtures/config.env
```

Fill `restHost`, `restOrgName`, `restAppName`, `restAppToken`, `appKey`,
`fixturePrefix`, and `fixturePassword`.

## Typical Flow

```bash
jmeter/tools/rest_fixtures/provision-users.sh --config jmeter/tools/rest_fixtures/config.env
jmeter/tools/rest_fixtures/run-scenario.sh contact --config jmeter/tools/rest_fixtures/config.env
jmeter/tools/rest_fixtures/run-suite.sh chat-manager/message-send-types contact --config jmeter/tools/rest_fixtures/config.env
```

## REST Documentation

Confirm concrete endpoints against the Easemob server-side docs before editing
`lib/rest.sh`:

- Overview: https://doc.easemob.com/document/server-side/overview.html
- Authorized single-user registration: https://doc.easemob.com/document/server-side/account_register_authorized_single.html
- Batch user deletion: https://doc.easemob.com/document/server-side/account_delete_batch.html

Add confirmed group, chat room, contact, and membership links here during
implementation.
```

- [ ] **Step 4: Verify files are tracked and runtime samples are ignored**

Run:

```bash
git status --short jmeter/tools/rest_fixtures .gitignore
```

Expected: the three new template/doc files are listed as untracked or modified inputs; no `jmeter/runtime` files appear.

---

### Task 3: Add Shared Bash Config Library

**Files:**

- Create: `jmeter/tools/rest_fixtures/lib/config.sh`

- [ ] **Step 1: Implement `config.sh`**

Use this content:

```bash
#!/usr/bin/env bash

REST_FIXTURES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${REST_FIXTURES_DIR}/../../.." && pwd)"
RUNTIME_DIR="${REPO_ROOT}/jmeter/runtime/rest-fixtures"
DEFAULT_CONFIG_FILE="${REST_FIXTURES_DIR}/config.env"
USERS_FILE="${RUNTIME_DIR}/users.env"
STATE_FILE="${RUNTIME_DIR}/state.json"
JMETER_PROPS_FILE="${RUNTIME_DIR}/jmeter-props.sh"
LOG_DIR="${RUNTIME_DIR}/logs"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '%s\n' "$*" >&2
}

ensure_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

ensure_runtime_dir() {
  mkdir -p "${RUNTIME_DIR}" "${LOG_DIR}"
}

parse_common_args() {
  CONFIG_FILE="${DEFAULT_CONFIG_FILE}"
  DRY_RUN='false'
  NO_RESET='false'
  DELETE_USERS='false'
  YES='false'
  SCENARIO=''
  ALL='false'
  CONTINUE_ON_FAILURE='false'
  POSITIONAL_ARGS=()

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --config)
        [ "$#" -ge 2 ] || die "--config requires a path"
        CONFIG_FILE="$2"
        shift 2
        ;;
      --dry-run)
        DRY_RUN='true'
        shift
        ;;
      --no-reset)
        NO_RESET='true'
        shift
        ;;
      --delete-users)
        DELETE_USERS='true'
        shift
        ;;
      --yes)
        YES='true'
        shift
        ;;
      --scenario)
        [ "$#" -ge 2 ] || die "--scenario requires a name"
        SCENARIO="$2"
        shift 2
        ;;
      --all)
        ALL='true'
        shift
        ;;
      --continue-on-failure)
        CONTINUE_ON_FAILURE='true'
        shift
        ;;
      --help|-h)
        SHOW_HELP='true'
        shift
        ;;
      --)
        shift
        while [ "$#" -gt 0 ]; do
          POSITIONAL_ARGS+=("$1")
          shift
        done
        ;;
      -*)
        die "unknown option: $1"
        ;;
      *)
        POSITIONAL_ARGS+=("$1")
        shift
        ;;
    esac
  done
}

load_config() {
  [ -f "${CONFIG_FILE}" ] || die "config file not found: ${CONFIG_FILE}"
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"

  url="${url:-localhost}"
  port="${port:-8083}"
  timeout="${timeout:-10000}"
  topic="${topic:-rn}"
  appKey="${appKey:-easemob-demo#zuoyu}"
  username="${username:-asterisk001}"
  password="${password:-qwerty}"
  fixturePrefix="${fixturePrefix:-wayang_demo}"
  fixturePassword="${fixturePassword:-qwerty}"
}

require_rest_config() {
  if [ "${DRY_RUN:-false}" = 'true' ]; then
    restHost="${restHost:-https://example.invalid}"
    restOrgName="${restOrgName:-dummy_org}"
    restAppName="${restAppName:-dummy_app}"
    restAppToken="${restAppToken:-dry_run_token}"
    return 0
  fi

  [ -n "${restHost:-}" ] || die "restHost is required"
  [ -n "${restOrgName:-}" ] || die "restOrgName is required"
  [ -n "${restAppName:-}" ] || die "restAppName is required"
  [ -n "${restAppToken:-}" ] || die "restAppToken is required"
}

load_users() {
  [ -f "${USERS_FILE}" ] || die "users file not found: ${USERS_FILE}; run provision-users.sh first"
  # shellcheck disable=SC1090
  source "${USERS_FILE}"

  [ "${APP_KEY:-}" = "${appKey}" ] || die "users.env APP_KEY '${APP_KEY:-}' does not match config appKey '${appKey}'"

  for required_var in \
    PRIMARY_USERNAME PRIMARY_PASSWORD \
    CONTACT_FRIEND_USERNAME CONTACT_NON_FRIEND_USERNAME CONTACT_DELETE_USERNAME CONTACT_ADD_USERNAME \
    CHAT_PEER_USERNAME \
    GROUP_OWNER_USERNAME GROUP_MEMBER_USERNAME_1 GROUP_MEMBER_USERNAME_2 GROUP_NON_MEMBER_USERNAME_1 GROUP_NON_MEMBER_USERNAME_2 \
    ROOM_OWNER_USERNAME ROOM_MEMBER_USERNAME_1 ROOM_MEMBER_USERNAME_2 ROOM_NON_MEMBER_USERNAME_1 ROOM_NON_MEMBER_USERNAME_2
  do
    eval "value=\${${required_var}:-}"
    [ -n "${value}" ] || die "users.env missing ${required_var}"
  done
}
```

- [ ] **Step 2: Verify syntax**

Run:

```bash
bash -n jmeter/tools/rest_fixtures/lib/config.sh
```

Expected: no output and exit code 0.

---

### Task 4: Add Scenario Mapping Library

**Files:**

- Create: `jmeter/tools/rest_fixtures/lib/scenarios.sh`

- [ ] **Step 1: Implement scenario mapping**

Use this content:

```bash
#!/usr/bin/env bash

scenario_jmx_path() {
  case "$1" in
    contact)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/rn-sdk-contact-manager.jmx"
      ;;
    group)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/rn-sdk-group-manager.jmx"
      ;;
    chat-room)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/rn-sdk-chat-room-manager.jmx"
      ;;
    chat-manager/message-basic-lifecycle)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-basic-lifecycle.jmx"
      ;;
    chat-manager/message-send-types)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-send-types.jmx"
      ;;
    chat-manager/message-query)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-query.jmx"
      ;;
    chat-manager/message-recall-delete)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-recall-delete.jmx"
      ;;
    chat-manager/message-translation)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-translation.jmx"
      ;;
    chat-manager/message-reaction)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-reaction.jmx"
      ;;
    chat-manager/message-pin)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-pin.jmx"
      ;;
    chat-manager/message-conversation)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-conversation.jmx"
      ;;
    chat-manager/message-target-types)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-target-types.jmx"
      ;;
    chat-manager/message-thread-management)
      printf '%s\n' "${REPO_ROOT}/jmeter/data/chat-manager/message-thread-management.jmx"
      ;;
    *)
      return 1
      ;;
  esac
}

scenario_reset_kinds() {
  case "$1" in
    contact)
      printf '%s\n' 'contact'
      ;;
    group)
      printf '%s\n' 'group'
      ;;
    chat-room)
      printf '%s\n' 'chat-room'
      ;;
    chat-manager/message-target-types)
      printf '%s\n' 'chat group chat-room'
      ;;
    chat-manager/message-thread-management)
      printf '%s\n' 'chat group'
      ;;
    chat-manager/*)
      printf '%s\n' 'chat'
      ;;
    *)
      return 1
      ;;
  esac
}

all_scenarios() {
  cat <<'EOF'
contact
group
chat-room
chat-manager/message-basic-lifecycle
chat-manager/message-send-types
chat-manager/message-query
chat-manager/message-recall-delete
chat-manager/message-translation
chat-manager/message-reaction
chat-manager/message-pin
chat-manager/message-conversation
chat-manager/message-target-types
chat-manager/message-thread-management
EOF
}
```

- [ ] **Step 2: Verify each mapped file exists**

Run:

```bash
bash -c '
set -e
source jmeter/tools/rest_fixtures/lib/config.sh
source jmeter/tools/rest_fixtures/lib/scenarios.sh
while IFS= read -r scenario; do
  path="$(scenario_jmx_path "$scenario")"
  test -f "$path" || { echo "missing $scenario -> $path"; exit 1; }
done < <(all_scenarios)
'
```

Expected: no output and exit code 0.

---

### Task 5: Add State And JMeter Property Libraries

**Files:**

- Create: `jmeter/tools/rest_fixtures/lib/state.sh`
- Create: `jmeter/tools/rest_fixtures/lib/jmeter_props.sh`

- [ ] **Step 1: Implement `state.sh`**

Use this content:

```bash
#!/usr/bin/env bash

init_state_file() {
  ensure_command jq
  ensure_runtime_dir
  if [ ! -f "${STATE_FILE}" ]; then
    jq -n \
      --arg appKey "${appKey}" \
      --arg prefix "${fixturePrefix}" \
      '{appKey:$appKey,prefix:$prefix,group:{},chatRoom:{},updatedAt:null}' \
      > "${STATE_FILE}"
  fi
}

validate_state_file() {
  init_state_file
  state_app_key="$(jq -r '.appKey // empty' "${STATE_FILE}")"
  [ "${state_app_key}" = "${appKey}" ] || die "state.json appKey '${state_app_key}' does not match config appKey '${appKey}'"
}

state_get() {
  jq -r "$1 // empty" "${STATE_FILE}"
}

state_set() {
  key_path="$1"
  value="$2"
  tmp_file="${STATE_FILE}.tmp"
  jq \
    --arg value "${value}" \
    --arg updatedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    "${key_path} = \$value | .updatedAt = \$updatedAt" \
    "${STATE_FILE}" > "${tmp_file}"
  mv "${tmp_file}" "${STATE_FILE}"
}
```

- [ ] **Step 2: Implement `jmeter_props.sh`**

Use this content:

```bash
#!/usr/bin/env bash

shell_quote() {
  printf "%q" "$1"
}

write_jmeter_props() {
  ensure_runtime_dir
  validate_state_file

  active_group_id="$(state_get '.group.activeGroupId')"
  destroyed_group_id="$(state_get '.group.destroyedGroupId')"
  active_room_id="$(state_get '.chatRoom.activeRoomId')"
  destroyed_room_id="$(state_get '.chatRoom.destroyedRoomId')"

  {
    printf '#!/usr/bin/env bash\n'
    printf '# Generated by jmeter/tools/rest_fixtures. Do not edit.\n'
    printf 'JMETER_PROPS=(\n'
    printf '  -Jurl=%s\n' "$(shell_quote "${url}")"
    printf '  -Jport=%s\n' "$(shell_quote "${port}")"
    printf '  -Jtimeout=%s\n' "$(shell_quote "${timeout}")"
    printf '  -Jtopic=%s\n' "$(shell_quote "${topic}")"
    printf '  -JappKey=%s\n' "$(shell_quote "${appKey}")"
    printf '  -Jusername=%s\n' "$(shell_quote "${PRIMARY_USERNAME}")"
    printf '  -Jpassword=%s\n' "$(shell_quote "${PRIMARY_PASSWORD}")"
    printf '  -JcontactUserId=%s\n' "$(shell_quote "${CONTACT_FRIEND_USERNAME}")"
    printf '  -JcontactFriendUserId=%s\n' "$(shell_quote "${CONTACT_FRIEND_USERNAME}")"
    printf '  -JcontactNonFriendUserId=%s\n' "$(shell_quote "${CONTACT_NON_FRIEND_USERNAME}")"
    printf '  -JcontactDeleteUserId=%s\n' "$(shell_quote "${CONTACT_DELETE_USERNAME}")"
    printf '  -JcontactAddUserId=%s\n' "$(shell_quote "${CONTACT_ADD_USERNAME}")"
    printf '  -JchatPeerUserId=%s\n' "$(shell_quote "${CHAT_PEER_USERNAME}")"
    [ -n "${active_group_id}" ] && printf '  -JgroupId=%s\n' "$(shell_quote "${active_group_id}")"
    [ -n "${destroyed_group_id}" ] && printf '  -JdestroyedGroupId=%s\n' "$(shell_quote "${destroyed_group_id}")"
    [ -n "${active_room_id}" ] && printf '  -JroomId=%s\n' "$(shell_quote "${active_room_id}")"
    [ -n "${destroyed_room_id}" ] && printf '  -JdestroyedRoomId=%s\n' "$(shell_quote "${destroyed_room_id}")"
    printf ')\n'
  } > "${JMETER_PROPS_FILE}"
}
```

- [ ] **Step 3: Verify generated props are sourceable**

Run:

```bash
mkdir -p jmeter/runtime/rest-fixtures
cp jmeter/tools/rest_fixtures/users.example.env jmeter/runtime/rest-fixtures/users.env
bash -c '
set -e
source jmeter/tools/rest_fixtures/lib/config.sh
CONFIG_FILE=jmeter/tools/rest_fixtures/config.example.env
source jmeter/tools/rest_fixtures/lib/config.sh
load_config
source jmeter/tools/rest_fixtures/lib/state.sh
source jmeter/tools/rest_fixtures/lib/jmeter_props.sh
load_users
write_jmeter_props
source jmeter/runtime/rest-fixtures/jmeter-props.sh
test "${JMETER_PROPS[0]}" = "-Jurl=localhost"
'
```

Expected: no output and exit code 0.

---

### Task 6: Add REST Library With Dry-Run Support

**Files:**

- Create: `jmeter/tools/rest_fixtures/lib/rest.sh`

- [ ] **Step 1: Implement REST helpers and fixture operation names**

Use this structure. Fill the endpoint paths only after confirming them against official docs:

```bash
#!/usr/bin/env bash

rest_base_url() {
  clean_host="${restHost%/}"
  printf '%s/%s/%s' "${clean_host}" "${restOrgName}" "${restAppName}"
}

rest_request() {
  method="$1"
  path="$2"
  body="${3:-}"
  operation="${4:-REST request}"

  url_value="$(rest_base_url)${path}"

  if [ "${DRY_RUN:-false}" = 'true' ]; then
    printf 'DRY_RUN %s %s %s\n' "${method}" "${url_value}" "${operation}" >&2
    printf '{}\n'
    return 0
  fi

  response_file="$(mktemp "${TMPDIR:-/tmp}/rn-wayang-rest-response.XXXXXX")"
  curl_args=(
    -sS
    -o "${response_file}"
    -w '%{http_code}'
    -X "${method}"
    -H 'Content-Type: application/json'
    -H 'Accept: application/json'
    -H "Authorization: Bearer ${restAppToken}"
  )
  if [ -n "${body}" ]; then
    curl_args+=(--data "${body}")
  fi
  curl_args+=("${url_value}")

  status="$(
    curl "${curl_args[@]}"
  )"

  response_body="$(cat "${response_file}")"
  rm -f "${response_file}"

  case "${status}" in
    200|201|202|204)
      printf '%s\n' "${response_body:-{}}"
      ;;
    *)
      printf 'ERROR: %s failed: HTTP %s\n%s\n' "${operation}" "${status}" "${response_body}" >&2
      return 1
      ;;
  esac
}

ensure_user() {
  user_id="$1"
  user_password="$2"
  body="$(jq -n --arg username "${user_id}" --arg password "${user_password}" '{username:$username,password:$password}')"
  rest_request POST '/users' "${body}" "ensure user ${user_id}" >/dev/null
}

delete_users_batch() {
  prefix="$1"
  [ "${DELETE_USERS:-false}" = 'true' ] || die "delete_users_batch requires --delete-users"
  [ "${YES:-false}" = 'true' ] || die "delete_users_batch requires --yes"
  [ -n "${prefix}" ] || die "delete user prefix is required"
  die "batch user deletion endpoint must be confirmed and implemented before use"
}

ensure_friend() {
  owner="$1"
  friend="$2"
  rest_request POST "/users/${owner}/contacts/users/${friend}" '{}' "ensure friend ${owner} -> ${friend}" >/dev/null
}

ensure_not_friend() {
  owner="$1"
  friend="$2"
  rest_request DELETE "/users/${owner}/contacts/users/${friend}" '' "ensure not friend ${owner} -> ${friend}" >/dev/null || true
}

ensure_group_fixture() {
  validate_state_file
  existing_group_id="$(state_get '.group.activeGroupId')"
  if [ -n "${existing_group_id}" ]; then
    return 0
  fi
  body="$(jq -n \
    --arg groupname "${fixturePrefix}_group" \
    --arg owner "${GROUP_OWNER_USERNAME}" \
    --argjson members "$(jq -n --arg a "${GROUP_MEMBER_USERNAME_1}" --arg b "${GROUP_MEMBER_USERNAME_2}" '[$a,$b]')" \
    '{groupname:$groupname,desc:"rn wayang jmeter fixture group",public:true,approval:false,owner:$owner,members:$members}')"
  response="$(rest_request POST '/chatgroups' "${body}" 'create group fixture')"
  group_id="$(printf '%s\n' "${response}" | jq -r '.data.groupid // .data.groupId // .groupid // empty')"
  [ -n "${group_id}" ] || die "create group fixture did not return group id"
  state_set '.group.activeGroupId' "${group_id}"
}

ensure_destroyed_group_fixture() {
  validate_state_file
  destroyed_group_id="$(state_get '.group.destroyedGroupId')"
  [ -n "${destroyed_group_id}" ] && return 0
  state_set '.group.destroyedGroupId' "${fixturePrefix}_destroyed_group_placeholder"
}

ensure_chat_room_fixture() {
  validate_state_file
  existing_room_id="$(state_get '.chatRoom.activeRoomId')"
  if [ -n "${existing_room_id}" ]; then
    return 0
  fi
  body="$(jq -n \
    --arg name "${fixturePrefix}_room" \
    --arg owner "${ROOM_OWNER_USERNAME}" \
    --argjson members "$(jq -n --arg a "${ROOM_MEMBER_USERNAME_1}" --arg b "${ROOM_MEMBER_USERNAME_2}" '[$a,$b]')" \
    '{name:$name,description:"rn wayang jmeter fixture room",owner:$owner,members:$members,maxusers:200}')"
  response="$(rest_request POST '/chatrooms' "${body}" 'create chat room fixture')"
  room_id="$(printf '%s\n' "${response}" | jq -r '.data.id // .data.roomid // .data.roomId // .id // empty')"
  [ -n "${room_id}" ] || die "create chat room fixture did not return room id"
  state_set '.chatRoom.activeRoomId' "${room_id}"
}

ensure_destroyed_room_fixture() {
  validate_state_file
  destroyed_room_id="$(state_get '.chatRoom.destroyedRoomId')"
  [ -n "${destroyed_room_id}" ] && return 0
  state_set '.chatRoom.destroyedRoomId' "${fixturePrefix}_destroyed_room_placeholder"
}
```

Important: the concrete endpoint paths shown above are implementation candidates. Confirm them against official Easemob docs before relying on live runs. Keep the dry-run path working without real credentials and without live REST calls.

- [ ] **Step 2: Verify syntax**

Run:

```bash
bash -n jmeter/tools/rest_fixtures/lib/rest.sh
```

Expected: no output and exit code 0.

---

### Task 7: Implement Account Provisioning Script

**Files:**

- Create: `jmeter/tools/rest_fixtures/provision-users.sh`

- [ ] **Step 1: Implement `provision-users.sh`**

Use this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/config.sh"

usage() {
  cat <<'EOF'
Usage: provision-users.sh [--config PATH] [--dry-run]

Creates or verifies the reusable account pool and writes:
  jmeter/runtime/rest-fixtures/users.env
EOF
}

parse_common_args "$@"
if [ "${SHOW_HELP:-false}" = 'true' ]; then
  usage
  exit 0
fi

load_config
require_rest_config
ensure_command jq
ensure_command curl
ensure_runtime_dir
source "${SCRIPT_DIR}/lib/rest.sh"

role_username() {
  index="$1"
  printf '%s_%03d' "${fixturePrefix}" "${index}"
}

PRIMARY_USERNAME="$(role_username 1)"
PRIMARY_PASSWORD="${fixturePassword}"
CONTACT_FRIEND_USERNAME="$(role_username 2)"
CONTACT_NON_FRIEND_USERNAME="$(role_username 3)"
CONTACT_DELETE_USERNAME="$(role_username 4)"
CONTACT_ADD_USERNAME="$(role_username 5)"
CHAT_PEER_USERNAME="$(role_username 6)"
GROUP_OWNER_USERNAME="$(role_username 7)"
GROUP_MEMBER_USERNAME_1="$(role_username 8)"
GROUP_MEMBER_USERNAME_2="$(role_username 9)"
GROUP_NON_MEMBER_USERNAME_1="$(role_username 10)"
GROUP_NON_MEMBER_USERNAME_2="$(role_username 11)"
ROOM_OWNER_USERNAME="$(role_username 12)"
ROOM_MEMBER_USERNAME_1="$(role_username 13)"
ROOM_MEMBER_USERNAME_2="$(role_username 14)"
ROOM_NON_MEMBER_USERNAME_1="$(role_username 15)"
ROOM_NON_MEMBER_USERNAME_2="$(role_username 16)"

for user_id in \
  "${PRIMARY_USERNAME}" \
  "${CONTACT_FRIEND_USERNAME}" "${CONTACT_NON_FRIEND_USERNAME}" "${CONTACT_DELETE_USERNAME}" "${CONTACT_ADD_USERNAME}" \
  "${CHAT_PEER_USERNAME}" \
  "${GROUP_OWNER_USERNAME}" "${GROUP_MEMBER_USERNAME_1}" "${GROUP_MEMBER_USERNAME_2}" "${GROUP_NON_MEMBER_USERNAME_1}" "${GROUP_NON_MEMBER_USERNAME_2}" \
  "${ROOM_OWNER_USERNAME}" "${ROOM_MEMBER_USERNAME_1}" "${ROOM_MEMBER_USERNAME_2}" "${ROOM_NON_MEMBER_USERNAME_1}" "${ROOM_NON_MEMBER_USERNAME_2}"
do
  ensure_user "${user_id}" "${fixturePassword}"
done

cat > "${USERS_FILE}" <<EOF
APP_KEY='${appKey}'
USER_PREFIX='${fixturePrefix}'
DEFAULT_PASSWORD='${fixturePassword}'

PRIMARY_USERNAME='${PRIMARY_USERNAME}'
PRIMARY_PASSWORD='${PRIMARY_PASSWORD}'

CONTACT_FRIEND_USERNAME='${CONTACT_FRIEND_USERNAME}'
CONTACT_NON_FRIEND_USERNAME='${CONTACT_NON_FRIEND_USERNAME}'
CONTACT_DELETE_USERNAME='${CONTACT_DELETE_USERNAME}'
CONTACT_ADD_USERNAME='${CONTACT_ADD_USERNAME}'

CHAT_PEER_USERNAME='${CHAT_PEER_USERNAME}'

GROUP_OWNER_USERNAME='${GROUP_OWNER_USERNAME}'
GROUP_MEMBER_USERNAME_1='${GROUP_MEMBER_USERNAME_1}'
GROUP_MEMBER_USERNAME_2='${GROUP_MEMBER_USERNAME_2}'
GROUP_NON_MEMBER_USERNAME_1='${GROUP_NON_MEMBER_USERNAME_1}'
GROUP_NON_MEMBER_USERNAME_2='${GROUP_NON_MEMBER_USERNAME_2}'

ROOM_OWNER_USERNAME='${ROOM_OWNER_USERNAME}'
ROOM_MEMBER_USERNAME_1='${ROOM_MEMBER_USERNAME_1}'
ROOM_MEMBER_USERNAME_2='${ROOM_MEMBER_USERNAME_2}'
ROOM_NON_MEMBER_USERNAME_1='${ROOM_NON_MEMBER_USERNAME_1}'
ROOM_NON_MEMBER_USERNAME_2='${ROOM_NON_MEMBER_USERNAME_2}'
EOF

info "wrote ${USERS_FILE}"
```

- [ ] **Step 2: Make executable**

Run:

```bash
chmod +x jmeter/tools/rest_fixtures/provision-users.sh
```

- [ ] **Step 3: Verify dry-run provisioning writes users.env**

Run:

```bash
jmeter/tools/rest_fixtures/provision-users.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --dry-run
test -f jmeter/runtime/rest-fixtures/users.env
rg -n "ROOM_MEMBER_USERNAME_2|CONTACT_ADD_USERNAME|APP_KEY" jmeter/runtime/rest-fixtures/users.env
```

Expected: dry-run prints `DRY_RUN` lines to stderr and `rg` finds the three role names.

---

### Task 8: Implement Fixture Reset Script

**Files:**

- Create: `jmeter/tools/rest_fixtures/reset-fixtures.sh`

- [ ] **Step 1: Implement `reset-fixtures.sh`**

Use this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/config.sh"

usage() {
  cat <<'EOF'
Usage: reset-fixtures.sh [--config PATH] [--scenario NAME] [--all] [--dry-run]

Restores server-side fixture state and writes jmeter-props.sh.
EOF
}

parse_common_args "$@"
if [ "${SHOW_HELP:-false}" = 'true' ]; then
  usage
  exit 0
fi

load_config
require_rest_config
ensure_command jq
ensure_command curl
ensure_runtime_dir
load_users
source "${SCRIPT_DIR}/lib/state.sh"
source "${SCRIPT_DIR}/lib/rest.sh"
source "${SCRIPT_DIR}/lib/jmeter_props.sh"

reset_contact() {
  ensure_friend "${PRIMARY_USERNAME}" "${CONTACT_FRIEND_USERNAME}"
  ensure_not_friend "${PRIMARY_USERNAME}" "${CONTACT_NON_FRIEND_USERNAME}"
  ensure_friend "${PRIMARY_USERNAME}" "${CONTACT_DELETE_USERNAME}"
  ensure_not_friend "${PRIMARY_USERNAME}" "${CONTACT_ADD_USERNAME}"
}

reset_chat() {
  ensure_friend "${PRIMARY_USERNAME}" "${CHAT_PEER_USERNAME}"
}

reset_group() {
  ensure_group_fixture
  ensure_destroyed_group_fixture
}

reset_chat_room() {
  ensure_chat_room_fixture
  ensure_destroyed_room_fixture
}

run_reset_kind() {
  case "$1" in
    contact) reset_contact ;;
    chat) reset_chat ;;
    group) reset_group ;;
    chat-room) reset_chat_room ;;
    *) die "unknown reset kind: $1" ;;
  esac
}

if [ "${ALL}" = 'true' ]; then
  RESET_KINDS='contact chat group chat-room'
elif [ -n "${SCENARIO}" ]; then
  source "${SCRIPT_DIR}/lib/scenarios.sh"
  RESET_KINDS="$(scenario_reset_kinds "${SCENARIO}")" || die "unknown scenario: ${SCENARIO}"
elif [ "${#POSITIONAL_ARGS[@]}" -gt 0 ]; then
  RESET_KINDS="${POSITIONAL_ARGS[*]}"
else
  die "provide --scenario NAME, --all, or reset kinds"
fi

validate_state_file
for kind in ${RESET_KINDS}; do
  run_reset_kind "${kind}"
done
write_jmeter_props
info "wrote ${JMETER_PROPS_FILE}"
```

- [ ] **Step 2: Make executable**

Run:

```bash
chmod +x jmeter/tools/rest_fixtures/reset-fixtures.sh
```

- [ ] **Step 3: Verify dry-run reset generates JMeter props**

Run:

```bash
jmeter/tools/rest_fixtures/reset-fixtures.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --scenario chat-manager/message-target-types \
  --dry-run
bash -n jmeter/runtime/rest-fixtures/jmeter-props.sh
bash -c 'source jmeter/runtime/rest-fixtures/jmeter-props.sh; printf "%s\n" "${JMETER_PROPS[@]}"' | rg -- '-J(username|contactUserId|groupId|roomId)='
```

Expected: `jmeter-props.sh` is valid Bash and generated args include username, contact, group, and room values.

---

### Task 9: Implement Destroy Script

**Files:**

- Create: `jmeter/tools/rest_fixtures/destroy-fixtures.sh`

- [ ] **Step 1: Implement safe destroy skeleton**

Use this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/config.sh"

usage() {
  cat <<'EOF'
Usage: destroy-fixtures.sh [--config PATH] [--scenario NAME] [--all] [--dry-run] [--delete-users --yes]

Cleans generated fixture resources. Users are preserved unless --delete-users
and --yes are both supplied.
EOF
}

parse_common_args "$@"
if [ "${SHOW_HELP:-false}" = 'true' ]; then
  usage
  exit 0
fi

load_config
require_rest_config
ensure_command jq
ensure_command curl
ensure_runtime_dir
load_users
source "${SCRIPT_DIR}/lib/state.sh"
source "${SCRIPT_DIR}/lib/rest.sh"

validate_state_file

if [ "${DELETE_USERS}" = 'true' ]; then
  delete_users_batch "${USER_PREFIX}"
  exit 0
fi

if [ "${ALL}" = 'true' ]; then
  info "destroy --all requested; group/chat-room deletion endpoints must be confirmed in lib/rest.sh before live cleanup"
elif [ -n "${SCENARIO}" ]; then
  info "destroy scenario '${SCENARIO}' requested; endpoint-specific cleanup must be confirmed in lib/rest.sh"
else
  die "provide --scenario NAME, --all, or --delete-users --yes"
fi
```

- [ ] **Step 2: Make executable and verify safety gates**

Run:

```bash
chmod +x jmeter/tools/rest_fixtures/destroy-fixtures.sh
jmeter/tools/rest_fixtures/destroy-fixtures.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --delete-users \
  --dry-run
```

Expected: command fails and prints that `--yes` is required.

---

### Task 10: Implement Scenario Runner

**Files:**

- Create: `jmeter/tools/rest_fixtures/run-scenario.sh`

- [ ] **Step 1: Implement `run-scenario.sh`**

Use this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/config.sh"
source "${SCRIPT_DIR}/lib/scenarios.sh"

usage() {
  cat <<'EOF'
Usage: run-scenario.sh [--config PATH] [--no-reset] [--dry-run] SCENARIO

Runs one mapped JMeter scenario. Reset runs by default.
EOF
}

parse_common_args "$@"
if [ "${SHOW_HELP:-false}" = 'true' ]; then
  usage
  exit 0
fi

[ "${#POSITIONAL_ARGS[@]}" -ge 1 ] || die "scenario name is required"
SCENARIO_NAME="${POSITIONAL_ARGS[0]}"

load_config
ensure_runtime_dir

jmx_file="$(scenario_jmx_path "${SCENARIO_NAME}")" || die "unknown scenario: ${SCENARIO_NAME}"
[ -f "${jmx_file}" ] || die "mapped JMX file not found: ${jmx_file}"

if [ "${NO_RESET}" != 'true' ]; then
  reset_args=(--config "${CONFIG_FILE}" --scenario "${SCENARIO_NAME}")
  if [ "${DRY_RUN}" = 'true' ]; then
    reset_args+=(--dry-run)
  fi
  "${SCRIPT_DIR}/reset-fixtures.sh" "${reset_args[@]}"
fi

[ -f "${JMETER_PROPS_FILE}" ] || die "jmeter props file not found: ${JMETER_PROPS_FILE}"
# shellcheck disable=SC1090
source "${JMETER_PROPS_FILE}"

timestamp="$(date '+%Y%m%d-%H%M%S')"
safe_name="$(printf '%s' "${SCENARIO_NAME}" | tr '/:' '__')"
jtl_file="${LOG_DIR}/${safe_name}-${timestamp}.jtl"
log_file="${LOG_DIR}/${safe_name}-${timestamp}.log"

JMETER_BIN="${JMETER_BIN:-/Applications/apache-jmeter-5.6.3/bin/jmeter}"

if [ "${DRY_RUN}" = 'true' ]; then
  printf 'DRY_RUN %s -n -t %s -l %s -j %s\n' "${JMETER_BIN}" "${jmx_file}" "${jtl_file}" "${log_file}" >&2
  printf 'DRY_RUN args: %s\n' "${JMETER_PROPS[*]}" >&2
  exit 0
fi

"${JMETER_BIN}" \
  -n \
  -t "${jmx_file}" \
  -l "${jtl_file}" \
  -j "${log_file}" \
  "${JMETER_PROPS[@]}" \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

- [ ] **Step 2: Make executable**

Run:

```bash
chmod +x jmeter/tools/rest_fixtures/run-scenario.sh
```

- [ ] **Step 3: Verify dry-run single scenario**

Run:

```bash
jmeter/tools/rest_fixtures/run-scenario.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --dry-run \
  chat-manager/message-send-types
```

Expected: output includes a dry-run JMeter command and generated `-Jusername=...` args.

---

### Task 11: Implement Suite Runner

**Files:**

- Create: `jmeter/tools/rest_fixtures/run-suite.sh`

- [ ] **Step 1: Implement `run-suite.sh`**

Use this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/config.sh"
source "${SCRIPT_DIR}/lib/scenarios.sh"

usage() {
  cat <<'EOF'
Usage: run-suite.sh [--config PATH] [--all] [--continue-on-failure] [--dry-run] [SCENARIO...]

Runs multiple scenarios by delegating to run-scenario.sh.
EOF
}

parse_common_args "$@"
if [ "${SHOW_HELP:-false}" = 'true' ]; then
  usage
  exit 0
fi

if [ "${ALL}" = 'true' ]; then
  SELECTED_SCENARIOS=()
  while IFS= read -r scenario; do
    SELECTED_SCENARIOS+=("${scenario}")
  done < <(all_scenarios)
elif [ "${#POSITIONAL_ARGS[@]}" -gt 0 ]; then
  SELECTED_SCENARIOS=("${POSITIONAL_ARGS[@]}")
else
  die "provide --all or at least one scenario"
fi

failed=0
for scenario in "${SELECTED_SCENARIOS[@]}"; do
  scenario_args=(--config "${CONFIG_FILE}")
  if [ "${DRY_RUN}" = 'true' ]; then
    scenario_args+=(--dry-run)
  fi
  if ! "${SCRIPT_DIR}/run-scenario.sh" "${scenario_args[@]}" "${scenario}"; then
    failed=1
    if [ "${CONTINUE_ON_FAILURE}" != 'true' ]; then
      exit 1
    fi
  fi
done

exit "${failed}"
```

- [ ] **Step 2: Make executable**

Run:

```bash
chmod +x jmeter/tools/rest_fixtures/run-suite.sh
```

- [ ] **Step 3: Verify dry-run suite**

Run:

```bash
jmeter/tools/rest_fixtures/run-suite.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --dry-run \
  contact chat-manager/message-send-types
```

Expected: output includes two dry-run JMeter commands.

---

### Task 12: Update JMeter README

**Files:**

- Modify: `jmeter/README.md`

- [ ] **Step 1: Add REST fixture section**

Add a section after the general CLI verification block:

```markdown
## REST fixture preparation

The scripts under `jmeter/tools/rest_fixtures/` can prepare reusable Easemob
server-side data before CLI JMeter runs. They keep REST credentials outside
JMeter and pass prepared SDK values to JMeter with `-J` properties.

Typical flow:

```sh
cp jmeter/tools/rest_fixtures/config.example.env jmeter/tools/rest_fixtures/config.env
# Fill REST values in config.env.
jmeter/tools/rest_fixtures/provision-users.sh --config jmeter/tools/rest_fixtures/config.env
jmeter/tools/rest_fixtures/run-scenario.sh contact --config jmeter/tools/rest_fixtures/config.env
jmeter/tools/rest_fixtures/run-suite.sh --all --config jmeter/tools/rest_fixtures/config.env
```

Generated files are written under `jmeter/runtime/rest-fixtures/` and ignored
by Git. Existing `.jmx` files do not read shell environment variables directly;
the runner scripts convert fixture data to JMeter `-J` properties.
```

- [ ] **Step 2: Verify Markdown references**

Run:

```bash
rg -n "REST fixture preparation|rest_fixtures|jmeter/runtime/rest-fixtures" jmeter/README.md
```

Expected: all three patterns are found.

---

### Task 13: Validate Scripts And Dry-Run Workflow

**Files:**

- Validate all created scripts.

- [ ] **Step 1: Run Bash syntax checks**

Run:

```bash
find jmeter/tools/rest_fixtures -name '*.sh' -print | sort | while read -r f; do
  bash -n "$f"
done
```

Expected: no output and exit code 0.

- [ ] **Step 2: Run end-to-end dry-run flow**

Run:

```bash
jmeter/tools/rest_fixtures/provision-users.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --dry-run

jmeter/tools/rest_fixtures/reset-fixtures.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --scenario chat-manager/message-target-types \
  --dry-run

jmeter/tools/rest_fixtures/run-scenario.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --dry-run \
  chat-manager/message-target-types
```

Expected:

- `users.env` exists and contains 16 role accounts.
- `state.json` exists and has `appKey`, `group`, and `chatRoom` keys.
- `jmeter-props.sh` exists and is sourceable.
- runner output prints a JMeter command instead of executing JMeter.

- [ ] **Step 3: Confirm REST token is not in generated JMeter properties**

Run:

```bash
if rg -n "restAppToken|Bearer" jmeter/runtime/rest-fixtures/jmeter-props.sh; then
  echo "unexpected REST token in JMeter props"
  exit 1
fi
```

Expected: no output and exit code 0.

- [ ] **Step 4: Confirm runtime files remain ignored**

Run:

```bash
git status --short --ignored jmeter/runtime/rest-fixtures | sed -n '1,40p'
```

Expected: runtime files are shown with `!!`, not `??`.

---

### Task 14: Live REST Validation Subtask

**Files:**

- No new files unless endpoint fixes are needed in `jmeter/tools/rest_fixtures/lib/rest.sh`.

Only start this task after Task 13 passes. This task uses real Easemob REST
credentials and live server mutations, so request credentials from the caller
before execution.

- [ ] **Step 1: Create local config**

Run:

```bash
cp jmeter/tools/rest_fixtures/config.example.env jmeter/tools/rest_fixtures/config.env
```

Ask the caller for the disposable app's real `restHost`, `restOrgName`,
`restAppName`, `restAppToken`, `appKey`, `fixturePrefix`, and
`fixturePassword`, then edit `config.env` locally. Do not commit `config.env`.

- [ ] **Step 2: Provision users against the disposable app**

Run:

```bash
jmeter/tools/rest_fixtures/provision-users.sh --config jmeter/tools/rest_fixtures/config.env
```

Expected: exits 0 and writes `jmeter/runtime/rest-fixtures/users.env`.

- [ ] **Step 3: Reset one small fixture**

Run:

```bash
jmeter/tools/rest_fixtures/reset-fixtures.sh \
  --config jmeter/tools/rest_fixtures/config.env \
  --scenario contact
```

Expected: exits 0 and writes `jmeter/runtime/rest-fixtures/jmeter-props.sh`.

- [ ] **Step 4: Classify live failures before changing code**

If live REST fails, classify the failure first:

```text
wrong REST endpoint path
wrong request body
expired or invalid app token
wrong org/app/appKey mapping
account already exists and endpoint returns a non-2xx duplicate response
eventual consistency requiring bounded retry
```

Fix only the confirmed category.

---

### Task 15: Final Review And Single Commit

**Files:**

- All files touched by prior tasks.

- [ ] **Step 1: Review tracked changes**

Run:

```bash
git status --short
git diff -- .gitignore jmeter/README.md jmeter/tools/rest_fixtures
```

Expected:

- Only intended source files are modified or untracked.
- No `jmeter/runtime/` files are staged or untracked.
- No real `config.env` or REST token appears in the diff.

- [ ] **Step 2: Run final verification**

Run:

```bash
find jmeter/tools/rest_fixtures -name '*.sh' -print | sort | while read -r f; do
  bash -n "$f"
done

jmeter/tools/rest_fixtures/run-suite.sh \
  --config jmeter/tools/rest_fixtures/config.example.env \
  --dry-run \
  contact chat-manager/message-send-types
```

Expected: syntax checks pass and dry-run suite prints two JMeter commands.

- [ ] **Step 3: Make one final commit**

Run:

```bash
git add .gitignore jmeter/README.md jmeter/tools/rest_fixtures
git commit -m "Add JMeter REST fixture tooling"
```

Expected: one commit contains the complete implementation.

## Self-Review Checklist

- The plan implements account provisioning, fixture reset, property handoff, scenario runner, suite runner, cleanup skeleton, docs, and git hygiene from the spec.
- The plan keeps REST credentials out of JMeter properties.
- The plan uses `users.env` as the account handoff file and `jmeter-props.sh` as a sourced Bash array file, not an exported environment variable.
- The plan supports single-scenario execution and suite execution.
- The plan preserves existing `.jmx` files.
- The plan uses one final commit, matching the user's preference.
