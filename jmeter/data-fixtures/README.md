# Data Fixtures

This package prepares Easemob REST API data for tests. It only manages fixed
accounts, contact relationships, one group, and one chat room.

It does not adapt JMeter variables, does not change `.jmx` files, and does not
prepare conversation data.

## Setup

Copy the config template and fill in the app token:

```bash
yarn prepare
```

Required config fields:

- `restHost`
- `restOrgName`
- `restAppName`
- `restAppToken`
- `userPrefix`
- `defaultPassword`

Optional config fields:

- `requestTimeoutMs` defaults to `30000`

`config.local.cjs` is ignored by git.

## Commands

```bash
yarn prepare
yarn prepare:accounts
yarn delete:accounts
yarn reset:relationships
yarn test
```

## Outputs

Runtime files are written under `.state/`, which is ignored by git:

```text
.state/accounts.env
.state/relationships.env
.state/logs/
```

The `.env` files contain only key-value fixture data. Execution details and REST
errors are written to timestamped log files.

## Safety

The app token is never written to `.env` outputs or logs. Account deletion
deletes only the fixed 16 usernames derived from `userPrefix`; it does not call
REST batch deletion.
