# JMeter REST Test Data Management Record

## Context

This record captures review decisions for:

- `docs/superpowers/specs/2026-06-18-jmeter-rest-test-data-management-design.md`
- `docs/superpowers/plans/2026-06-18-jmeter-rest-test-data-management.md`

The current implementation boundary is REST-driven test data preparation. JMeter
test case conversion is expected, but it is not part of this data-preparation
task.

## Decisions And Follow-Up Items

### JMeter `-J` Property Handoff Requires JMX Conversion

The REST fixture runner should pass prepared values to JMeter through `-J`
properties. Existing JMeter files still contain hardcoded user and resource
values in several places. Those hardcoded values are expected to be converted in
JMeter test-case work.

Decision:

- Keep the REST fixture task focused on preparing data and generating
  properties.
- Record that JMeter files must be updated to consume these properties, for
  example through `${__P(name, default)}` or another JMeter-side adaptation.
- Property names from the fixture design should remain the shared contract where
  practical.

Impact:

- Until a `.jmx` file is converted, generated `-J` properties may not affect
  that plan.
- This is not a blocker for building the fixture tooling, but it must be tracked
  for scenario validation.

### Account Provisioning Must Be Repeatable

Provisioning must create or verify the reusable fixture account pool. A second
run should not fail only because accounts already exist.

Required plan change:

- `ensure_user` must handle existing users as a usable state.
- If the create endpoint returns a duplicate/existing-user response, the script
  should verify the account exists before treating the operation as successful.
- A real REST run should classify duplicate-user responses separately from auth,
  app mapping, or request-body failures.

### Group And Chat Room Reset Must Repair State

Fixture reset must establish usable server state before JMeter runs. It cannot
return success only because `state.json` contains an ID.

Required plan change:

- Active group and chat-room IDs from `state.json` must be verified against the
  server before reuse.
- If a resource is missing or has incorrect membership, reset must repair it or
  create a replacement and update `state.json`.
- Member and non-member roles must be verified or restored for every reset kind
  that needs them.
- Destroyed group/room IDs should be real destroyed resources when scenarios
  need that behavior, not placeholder strings.

### Contact JMX Role Mismatch Belongs To JMeter Scenario Work

The fixture design separates contact roles such as friend, non-friend, delete
target, and add target. Some existing contact JMeter files still use a single
hardcoded `contactUserId` across operations that need different preconditions.

Decision:

- Keep the role model in the fixture design.
- Record that current JMeter test files need scenario-level conversion before
  they can consume these distinct roles correctly.
- Disabled or unverified JMeter steps may currently contain data-affecting
  assumptions and should be removed or rewritten during scenario-specific
  validation.

Impact:

- The fixture task should expose enough role-specific properties for converted
  plans.
- It should not try to make one legacy `contactUserId` satisfy conflicting add,
  delete, block, unblock, and remark preconditions.

### User Cleanup Should Delete Explicit Fixture Users

Prefix-scoped batch deletion is unsafe if the REST API deletes by limit/cursor
instead of explicit usernames.

Required plan change:

- Replace prefix-based batch deletion with explicit deletion of usernames from
  `users.env`.
- Preserve the `--delete-users --yes` safety gate.
- Delete users one by one, or use an API that explicitly accepts a known set of
  usernames if confirmed in the official documentation.

### Username And Password Override Requires JMeter Conversion

The design mentions that `PRIMARY_USERNAME` maps to the JMeter `username`
property unless the caller explicitly overrides it. Existing hardcoded JMeter
files still need conversion before this override can be consistently honored.

Decision:

- Track username/password override as part of the property contract and JMeter
  conversion work.
- Fixture scripts should define clear precedence before implementation:
  generated primary account by default, explicit caller override only if the
  selected scenario is intended to run with that external account.

### JMX Modification Boundary

This data-preparation task should not modify existing `.jmx` files. The JMeter
files are known to need later conversion from hardcoded data to fixture-driven
properties.

Decision:

- Do not expand this implementation task to edit all affected `.jmx` files.
- Keep JMeter data adaptation as a separate follow-up task.

### Suite Scope

`run-suite.sh --all` should cover all JMeter test cases, including plans in
subdirectories.

Required plan change:

- `all_scenarios` should include every intended `.jmx` under `jmeter/data/`,
  including files in child directories.
- The reset mapping for each scenario should identify the minimal fixture kinds
  it needs.

### Live REST Validation Should Be A Separate Subtask

Calling real REST APIs is part of the overall work, but endpoint confirmation
and live validation should be separated from the dry-run framework task.

Required plan change:

- Split the implementation into a dry-run/tooling subtask and a live REST
  endpoint-validation subtask.
- The live subtask should request real credentials before execution.
- Required credential/config names should be documented before live execution.

### Dry-Run Semantics Need Clarification

Dry-run should simulate REST mutations well enough to validate script flow,
runtime file generation, JMeter property generation, and runner command
construction without requiring a real token.

Required plan change:

- Dry-run should not require a real `restAppToken`.
- Dry-run may require non-secret dummy values for URL/org/app fields if those
  are needed to construct visible operation logs.
- Live REST execution must require real credentials and should ask for them
  before running.
