#!/usr/bin/env bash

set -u

REST_HOST="${REST_HOST:-http://ngi-a1.easemob.com}"
REST_ORG_NAME="${REST_ORG_NAME:-easemob-demo}"
REST_APP_NAME="${REST_APP_NAME:-demo}"
FIXTURE_PASSWORD="${FIXTURE_PASSWORD:-qwerty}"
PREFIX="${PREFIX:-wayang_probe_$(date +%Y%m%d%H%M%S)}"
DRY_RUN='false'
SKIP_CLEANUP='false'

created_users=''
group_id=''
room_id=''
failures=0

usage() {
  cat <<'EOF'
Usage:
  EASEMOB_APP_TOKEN='<app token>' jmeter/tools/easemob_rest_probe/verify-easemob-rest.sh

Options:
  --dry-run        Print the planned REST calls without sending requests.
  --skip-cleanup   Keep created users, group, and chat room for inspection.
  --prefix VALUE   Use a specific username/name prefix.

Environment:
  EASEMOB_APP_TOKEN  Required unless --dry-run is used.
  REST_HOST          Default: http://ngi-a1.easemob.com
  REST_ORG_NAME      Default: easemob-demo
  REST_APP_NAME      Default: demo
  FIXTURE_PASSWORD   Default: qwerty
  PREFIX             Default: wayang_probe_<timestamp>
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN='true'
      shift
      ;;
    --skip-cleanup)
      SKIP_CLEANUP='true'
      shift
      ;;
    --prefix)
      [ "$#" -ge 2 ] || { printf 'ERROR: --prefix requires a value\n' >&2; exit 2; }
      PREFIX="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'ERROR: unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

BASE_URL="${REST_HOST%/}/${REST_ORG_NAME}/${REST_APP_NAME}"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'ERROR: missing required command: %s\n' "$1" >&2
    exit 2
  }
}

json_quote() {
  jq -Rn --arg value "$1" '$value'
}

redact_json() {
  jq 'del(.access_token, .uri) | if has("application") then .application="<redacted>" else . end'
}

log_step() {
  printf '\n== %s ==\n' "$1"
}

record_failure() {
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$1" >&2
}

expect_jq() {
  label="$1"
  filter="$2"
  body_file="$3"
  if jq -e "$filter" "$body_file" >/dev/null 2>&1; then
    printf 'PASS: %s\n' "$label"
    return 0
  fi
  record_failure "$label"
  printf 'Response:\n' >&2
  redact_json < "$body_file" >&2 || cat "$body_file" >&2
  return 1
}

api() {
  method="$1"
  path="$2"
  body="${3:-}"
  label="$4"

  url="${BASE_URL}${path}"
  printf '%s %s\n' "$method" "$path" >&2

  if [ "${DRY_RUN}" = 'true' ]; then
    [ -n "$body" ] && printf 'body: %s\n' "$body" >&2
    return 0
  fi

  tmp_body="$(mktemp)"
  tmp_headers="$(mktemp)"

  if [ -n "$body" ]; then
    curl --silent --show-error \
      --request "$method" "$url" \
      --header 'Content-Type: application/json' \
      --header 'Accept: application/json' \
      --header "Authorization: Bearer ${EASEMOB_APP_TOKEN}" \
      --data "$body" \
      --dump-header "$tmp_headers" \
      --output "$tmp_body"
  else
    curl --silent --show-error \
      --request "$method" "$url" \
      --header 'Accept: application/json' \
      --header "Authorization: Bearer ${EASEMOB_APP_TOKEN}" \
      --dump-header "$tmp_headers" \
      --output "$tmp_body"
  fi

  status="$(awk 'index(toupper($1), "HTTP/") == 1 { code=$2 } END { print code }' "$tmp_headers")"
  printf 'HTTP %s\n' "${status:-unknown}" >&2
  if [ "${status:-0}" -lt 200 ] || [ "${status:-0}" -ge 300 ]; then
    record_failure "${label}: HTTP ${status:-unknown}"
    redact_json < "$tmp_body" >&2 || cat "$tmp_body" >&2
  fi

  cat "$tmp_body"
  rm -f "$tmp_headers"
  return 0
}

api_to_file() {
  out_file="$1"
  shift
  api "$@" > "$out_file"
}

register_users() {
  log_step 'Register probe users'
  users_json='['
  index=1
  for role in owner friend member extra room_owner room_member; do
    username="${PREFIX}_${role}"
    created_users="${created_users} ${username}"
    item="$(jq -n --arg username "$username" --arg password "$FIXTURE_PASSWORD" '{username:$username,password:$password}')"
    if [ "$index" -gt 1 ]; then
      users_json="${users_json},"
    fi
    users_json="${users_json}${item}"
    index=$((index + 1))
  done
  users_json="${users_json}]"

  body_file="$(mktemp)"
  api_to_file "$body_file" 'POST' '/users' "$users_json" 'authorized account registration'
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'registered all probe users' '.entities | length == 6' "$body_file"
  rm -f "$body_file"
}

verify_user_query() {
  owner="${PREFIX}_owner"

  log_step 'Query registered user'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'GET' "/users/${owner}" '' 'query user'
  owner_json="$(json_quote "$owner")"
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'user query returned owner entity' ".entities[]?.username == ${owner_json} and .count == 1" "$body_file"
  rm -f "$body_file"
}

verify_password_reset() {
  owner="${PREFIX}_owner"

  log_step 'Reset registered user password'
  reset_body="$(jq -n --arg newpassword "${FIXTURE_PASSWORD}" '{newpassword:$newpassword}')"
  body_file="$(mktemp)"
  api_to_file "$body_file" 'PUT' "/users/${owner}/password" "$reset_body" 'reset user password'
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'password reset returned expected action' '.action == "set user password"' "$body_file"
  rm -f "$body_file"
}

verify_contacts() {
  owner="${PREFIX}_owner"
  friend="${PREFIX}_friend"

  log_step 'Add friend/contact'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'POST' "/users/${owner}/contacts/users/${friend}" '' 'add friend'
  friend_json="$(json_quote "$friend")"
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'friend add returned friend entity' ".entities[]?.username == ${friend_json}" "$body_file"
  rm -f "$body_file"

  log_step 'Delete friend/contact'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'DELETE' "/users/${owner}/contacts/users/${friend}" '' 'delete friend'
  friend_json="$(json_quote "$friend")"
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'friend delete returned friend entity' ".entities[]?.username == ${friend_json}" "$body_file"
  rm -f "$body_file"
}

verify_group() {
  owner="${PREFIX}_owner"
  first_member="${PREFIX}_member"
  second_member="${PREFIX}_extra"

  log_step 'Create group'
  create_body="$(jq -n \
    --arg groupname "${PREFIX}_group" \
    --arg owner "$owner" \
    --arg member "$first_member" \
    '{groupname:$groupname,description:"REST probe group",public:true,maxusers:300,owner:$owner,members:[$member]}')"
  body_file="$(mktemp)"
  api_to_file "$body_file" 'POST' '/chatgroups' "$create_body" 'create group'
  if [ "${DRY_RUN}" != 'true' ]; then
    expect_jq 'group create returned data.groupid' '.data.groupid | type == "string" and length > 0' "$body_file"
    group_id="$(jq -r '.data.groupid // empty' "$body_file")"
    printf 'group_id=%s\n' "$group_id"
  fi
  rm -f "$body_file"

  [ "${DRY_RUN}" = 'true' ] && group_id='DRY_RUN_GROUP_ID'

  log_step 'Add group member'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'POST' "/chatgroups/${group_id}/users/${second_member}?need_notify=false" '' 'add group member'
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'group member add result true' '.data.result == true and .data.action == "add_member"' "$body_file"
  rm -f "$body_file"

  log_step 'List group members'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'GET' "/chatgroups/${group_id}/users?pagenum=1&pagesize=1000&joined_time=true" '' 'list group members'
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'group member list contains owner/member data' '.data | type == "array" and length >= 2' "$body_file"
  rm -f "$body_file"

  log_step 'Remove group member'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'DELETE' "/chatgroups/${group_id}/users/${second_member}?need_notify=false" '' 'remove group member'
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'group member remove result true' '.data.result == true and .data.action == "remove_member"' "$body_file"
  rm -f "$body_file"
}

verify_chatroom() {
  owner="${PREFIX}_room_owner"
  first_member="${PREFIX}_room_member"
  second_member="${PREFIX}_extra"

  log_step 'Create chat room'
  create_body="$(jq -n \
    --arg name "${PREFIX}_room" \
    --arg owner "$owner" \
    --arg member "$first_member" \
    '{name:$name,description:"REST probe chat room",maxusers:300,owner:$owner,members:[$member]}')"
  body_file="$(mktemp)"
  api_to_file "$body_file" 'POST' '/chatrooms' "$create_body" 'create chat room'
  if [ "${DRY_RUN}" != 'true' ]; then
    expect_jq 'chat room create returned data.id' '.data.id | type == "string" and length > 0' "$body_file"
    room_id="$(jq -r '.data.id // .data.roomid // .data.chatroomid // empty' "$body_file")"
    printf 'room_id=%s\n' "$room_id"
  fi
  rm -f "$body_file"

  [ "${DRY_RUN}" = 'true' ] && room_id='DRY_RUN_ROOM_ID'

  log_step 'Add chat room member'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'POST' "/chatrooms/${room_id}/users/${second_member}" '' 'add chat room member'
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'chat room member add result true' '.data.result == true and .data.action == "add_member"' "$body_file"
  rm -f "$body_file"

  log_step 'List chat room members'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'GET' "/chatrooms/${room_id}/users?pagenum=1&pagesize=1000" '' 'list chat room members'
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'chat room member list contains owner/member data' '.data | type == "array" and length >= 2' "$body_file"
  rm -f "$body_file"

  log_step 'Remove chat room member'
  body_file="$(mktemp)"
  api_to_file "$body_file" 'DELETE' "/chatrooms/${room_id}/users/${second_member}" '' 'remove chat room member'
  [ "${DRY_RUN}" = 'true' ] || expect_jq 'chat room member remove result true' '.data.result == true and .data.action == "remove_member"' "$body_file"
  rm -f "$body_file"
}

cleanup() {
  [ "${DRY_RUN}" = 'true' ] && return 0
  [ "${SKIP_CLEANUP}" = 'true' ] && {
    printf '\nSkipping cleanup. Prefix: %s\n' "$PREFIX"
    return 0
  }

  log_step 'Cleanup probe resources'
  if [ -n "${room_id}" ]; then
    api 'DELETE' "/chatrooms/${room_id}" '' 'delete chat room' >/tmp/easemob-probe-cleanup-room.json || true
    redact_json < /tmp/easemob-probe-cleanup-room.json || cat /tmp/easemob-probe-cleanup-room.json
    rm -f /tmp/easemob-probe-cleanup-room.json
  fi
  if [ -n "${group_id}" ]; then
    api 'DELETE' "/chatgroups/${group_id}" '' 'delete group' >/tmp/easemob-probe-cleanup-group.json || true
    redact_json < /tmp/easemob-probe-cleanup-group.json || cat /tmp/easemob-probe-cleanup-group.json
    rm -f /tmp/easemob-probe-cleanup-group.json
  fi
  for username in $created_users; do
    api 'DELETE' "/users/${username}" '' "delete user ${username}" >/tmp/easemob-probe-cleanup-user.json || true
    redact_json < /tmp/easemob-probe-cleanup-user.json || cat /tmp/easemob-probe-cleanup-user.json
    rm -f /tmp/easemob-probe-cleanup-user.json
  done
}

require_command curl
require_command jq

if [ "${DRY_RUN}" != 'true' ] && [ -z "${EASEMOB_APP_TOKEN:-}" ]; then
  printf 'ERROR: EASEMOB_APP_TOKEN is required unless --dry-run is used\n' >&2
  exit 2
fi

trap cleanup EXIT

printf 'REST host: %s\n' "$REST_HOST"
printf 'REST org/app: %s/%s\n' "$REST_ORG_NAME" "$REST_APP_NAME"
printf 'Probe prefix: %s\n' "$PREFIX"

register_users
verify_user_query
verify_password_reset
verify_contacts
verify_group
verify_chatroom

if [ "$failures" -gt 0 ]; then
  printf '\nREST probe completed with %s failure(s).\n' "$failures" >&2
  exit 1
fi

printf '\nREST probe completed successfully.\n'
