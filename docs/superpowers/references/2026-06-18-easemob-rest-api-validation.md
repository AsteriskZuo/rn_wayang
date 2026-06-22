# Easemob REST API Validation Notes

Purpose: validate the REST calls needed by the JMeter REST fixture plan before
turning them into the formal `jmeter/tools/rest_fixtures/` implementation.

This is a reference artifact, not the production fixture design. The probe
script intentionally lives outside the planned fixture directory:

```text
jmeter/tools/easemob_rest_probe/verify-easemob-rest.sh
```

## Runtime Configuration

Validated app coordinates supplied by the caller:

```bash
REST_HOST='http://ngi-a1.easemob.com'
REST_ORG_NAME='easemob-demo'
REST_APP_NAME='demo'
```

The app token must be supplied at runtime and must not be committed:

```bash
EASEMOB_APP_TOKEN='<app token>' \
  jmeter/tools/easemob_rest_probe/verify-easemob-rest.sh
```

Dry-run command:

```bash
jmeter/tools/easemob_rest_probe/verify-easemob-rest.sh --dry-run
```

## Official Documentation Sources

- Overview: https://doc.easemob.com/document/server-side/overview.html
- Authorized account registration: https://doc.easemob.com/document/server-side/account_register_authorized_single.html
- Single account query: https://doc.easemob.com/document/server-side/account_detail_obtain_single.html
- Account password change: https://doc.easemob.com/document/server-side/account_password_change.html
- Single account deletion: https://doc.easemob.com/document/server-side/account_delete_single.html
- Batch account deletion: https://doc.easemob.com/document/server-side/account_delete_batch.html
- Add friend: https://doc.easemob.com/document/server-side/user_friend_add.html
- Delete friend: https://doc.easemob.com/document/server-side/user_friend_remove.html
- Remove user block-list entry: endpoint shape inferred from the Easemob REST
  user block-list family and fixture implementation; validate in the next live
  REST probe before relying on it for non-test apps.
- Create group: https://doc.easemob.com/document/server-side/group_create.html
- Delete group: https://doc.easemob.com/document/server-side/group_delete.html
- Add group member: https://doc.easemob.com/document/server-side/group_member_add_single.html
- List group members: https://doc.easemob.com/document/server-side/group_member_list_obtain.html
- Remove group member: https://doc.easemob.com/document/server-side/group_member_remove_single.html
- Create chat room: https://doc.easemob.com/document/server-side/chatroom_create.html
- Delete chat room: https://doc.easemob.com/document/server-side/chatroom_delete.html
- Add chat room member: https://doc.easemob.com/document/server-side/chatroom_member_add_single.html
- List chat room members: https://doc.easemob.com/document/server-side/chatroom_member_list_obtain.html
- Remove chat room member: https://doc.easemob.com/document/server-side/chatroom_member_remove_single.html

## Confirmed Request Shapes

All requests use these headers:

```http
Accept: application/json
Authorization: Bearer <app token>
```

Requests with JSON bodies also use:

```http
Content-Type: application/json
```

Base URL:

```text
{REST_HOST}/{REST_ORG_NAME}/{REST_APP_NAME}
```

### Accounts

Authorized registration:

```http
POST /users
```

Body is an array, even when creating one user:

```json
[
  {
    "username": "user1",
    "password": "qwerty"
  }
]
```

The response contains created users under `entities[]`.

Single account deletion:

```http
DELETE /users/{username}
```

The response contains deleted users under `entities[]`.

Single account query:

```http
GET /users/{username}
```

The response contains the matched user under `entities[]` and returns
`count: 1` when the user exists.

Account password change:

```http
PUT /users/{username}/password
```

Body:

```json
{
  "newpassword": "qwerty"
}
```

The documented response is:

```json
{
  "action": "set user password",
  "timestamp": 1542595598924,
  "duration": 8
}
```

Batch account deletion:

```http
DELETE /users?limit={N}&cursor={cursor}
```

Important: this endpoint deletes a page of users selected by the service. It is
not a "delete these usernames" endpoint. The probe script does not call it
because it can delete unrelated users. The formal fixture cleanup should delete
known fixture users one by one with `DELETE /users/{username}` unless a safer
batch-by-username endpoint is found.

### Contacts

Add friend:

```http
POST /users/{owner_username}/contacts/users/{friend_username}
```

No request body. The response contains the friend under `entities[]`.

Delete friend:

```http
DELETE /users/{owner_username}/contacts/users/{friend_username}
```

No request body. The response contains the removed friend under `entities[]`.

Remove user block-list entry:

```http
DELETE /users/{owner_username}/blocks/users/{blocked_username}
```

No request body. The fixture reset uses this endpoint only as a cleanup
operation. Missing entries are treated as already clean. Unexpected REST
failures fail the reset so `CONTACT_FIXTURE_READY=true` is not written.

### Groups

Create group:

```http
POST /chatgroups
```

Body:

```json
{
  "groupname": "testgroup",
  "description": "test",
  "public": true,
  "maxusers": 300,
  "owner": "owner_username",
  "members": ["member_username"]
}
```

The response stores the created ID at `data.groupid`.

Add one group member:

```http
POST /chatgroups/{group_id}/users/{username}?need_notify=false
```

No request body. The expected response has `data.result == true` and
`data.action == "add_member"`.

List group members:

```http
GET /chatgroups/{group_id}/users?pagenum=1&pagesize=1000&joined_time=true
```

The response stores members under `data[]`. Owner rows use an `owner` key;
member rows use a `member` key.

Remove one group member:

```http
DELETE /chatgroups/{group_id}/users/{username}?need_notify=false
```

No request body. The expected response has `data.result == true` and
`data.action == "remove_member"`.

Delete group:

```http
DELETE /chatgroups/{group_id}
```

The expected response has `data.success == true` and `data.groupid`.

### Chat Rooms

Create chat room:

```http
POST /chatrooms
```

Body:

```json
{
  "name": "testchatroom",
  "description": "test",
  "maxusers": 300,
  "owner": "owner_username",
  "members": ["member_username"]
}
```

The documented examples for create chat room do not show the full response in
the downloaded page. The probe expects the created ID at `data.id` and also
checks `data.roomid` and `data.chatroomid` as fallbacks while validating the
real service response.

Add one chat room member:

```http
POST /chatrooms/{chatroom_id}/users/{username}
```

No request body. The expected response has `data.result == true` and
`data.action == "add_member"`.

List chat room members:

```http
GET /chatrooms/{chatroom_id}/users?pagenum=1&pagesize=1000
```

The response stores members under `data[]`. Owner rows use an `owner` key;
member rows use a `member` key.

Remove one chat room member:

```http
DELETE /chatrooms/{chatroom_id}/users/{username}
```

No request body. The expected response has `data.result == true` and
`data.action == "remove_member"`.

Delete chat room:

```http
DELETE /chatrooms/{chatroom_id}
```

The expected response has `data.success == true` and `data.id`.

## Live Validation Result

Validated on June 18, 2026, against:

```text
http://ngi-a1.easemob.com/easemob-demo/demo
```

Probe command shape:

```bash
EASEMOB_APP_TOKEN='<redacted>' \
  bash jmeter/tools/easemob_rest_probe/verify-easemob-rest.sh \
  --prefix wayang_probe_live_20260618_2141
```

Result: all probe steps returned HTTP 200 and passed response assertions.

Created during the run:

```text
group_id=317080531435524
room_id=317080532484098
```

Cleanup result: all cleanup calls returned HTTP 200:

- `DELETE /chatrooms/317080532484098`
- `DELETE /chatgroups/317080531435524`
- `DELETE /users/wayang_probe_live_20260618_2141_owner`
- `DELETE /users/wayang_probe_live_20260618_2141_friend`
- `DELETE /users/wayang_probe_live_20260618_2141_member`
- `DELETE /users/wayang_probe_live_20260618_2141_extra`
- `DELETE /users/wayang_probe_live_20260618_2141_room_owner`
- `DELETE /users/wayang_probe_live_20260618_2141_room_member`

Observed response-shape details:

- `POST /users` returned created accounts in `entities[]`.
- `GET /users/{username}` returned the matched account in `entities[]` with
  `count: 1`.
- `PUT /users/{username}/password` returned HTTP 200 with
  `action:"set user password"`.
- Repeating `POST /users` for existing usernames returned HTTP 400 with
  `error:"duplicate_unique_property_exists"` and
  `exception:"DuplicateUniquePropertyExistsException"`. Registration is not
  idempotent.
- Friend add/delete returned the affected friend in `entities[]`.
- `POST /chatgroups` returned the group ID at `data.groupid`.
- Group member list returned `data[]` rows with `owner` or `member`; when
  `joined_time=true`, rows included `joined_time`.
- `POST /chatrooms` returned the chat room ID at `data.id`.
- Chat room member list returned `data[]` rows with `owner` or `member`.
- Delete user returned the deleted user in `entities[]` with `activated:false`.

## Implications For The Formal Fixture Plan

- Store raw REST paths only in the future `lib/rest.sh`.
- Registration should send a JSON array to `POST /users`.
- Provisioning must handle duplicate usernames explicitly. Either delete known
  fixture users before registration, query/filter existing users before
  registering, or treat `duplicate_unique_property_exists` as an already-exists
  outcome when the desired account set is stable.
- When provisioning sees an existing fixture user, it can query the user and
  reset the password with `PUT /users/{username}/password` to recover a usable
  account without deleting it first.
- Do not implement cleanup with `DELETE /users?limit=N`; it is unsafe for known
  fixture users.
- Cleanup should delete known users individually with `DELETE /users/{username}`.
- Group IDs should be read from `data.groupid`.
- Chat room ID extraction must be based on live validation. The probe currently
  accepts `data.id`, `data.roomid`, or `data.chatroomid` until verified.
