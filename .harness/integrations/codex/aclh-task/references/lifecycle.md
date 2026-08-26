# ACLH External Task Lifecycle

`PROJECT_ROOT` is the consumer Git repository. Runtime remains under
`ACLH_RUNTIME_ROOT`. Invoke Runtime scripts with:

```bash
export ACLH_PROJECT_ROOT="$PROJECT_ROOT"
node "$ACLH_RUNTIME_ROOT/.harness/scripts/<script>.ts" ...
```

## 1. Bootstrap

Understand the goal, user-visible behavior, constraints, and material ambiguities.
Inspect consumer Git state and preserve unrelated work. Load bounded choices once:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/task-contract.ts" --json
```

Assess Classification, risk, one verification strategy, and minimal explicit
Skills. Initialize and validate a new task:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/init-task.ts" <TASK_ID> --risk <LEVEL> --strategy <STRATEGY>
node "$ACLH_RUNTIME_ROOT/.harness/scripts/classification.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --resolve
node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-readiness.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-scope.ts" <TASK_ID> --generate
node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --generate
```

The `task-contract.ts --json` response is the authoritative authoring schema and
contains valid shapes for Classification, Skill Plan, Verification Gaps, and
Skill outputs. Do not inspect Runtime source, tests, or README files to discover
those formats.

Do not write resolved Skills manually. Continue an existing task only when its
identity matches the current branch; use managed snapshot/resync commands for a
human handoff.

## 2. Specify, plan, and decompose

Before product implementation, replace every planning placeholder and author:

1. `spec.md` — problem, user scenarios, functional requirements, acceptance
   criteria, edge cases, and out-of-scope behavior;
2. `plan.md` — technical context, architecture, data/contracts, implementation,
   verification, and risks;
3. `tasks.md` — ordered implementation and verification tasks, dependencies, and
   acceptance mapping.

Verify the planning boundary:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/task-planning.ts" <TASK_ID> --verify
```

These files must refine the request and project context; do not merely restate the
user prompt.

## 3. Build and verify

Implement the smallest root fix and complete required task/Skill outputs. After
governed content stabilizes, use one bounded Runtime command to refresh Context,
run only policy-required checks, and report Builder readiness:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/builder-finalize.ts" <TASK_ID> --json
```

Browser verification is opt-in. It runs only when `verification-gaps.yaml`
explicitly declares `machine_proofs: [browser]` because the request or acceptance
criteria require browser interaction or visual verification. Small tasks and
ordinary API/code tasks omit that proof. Never claim verification without machine
Evidence. Builder self-review remains available for compatibility but is not a
default gate.

## 4. Independent Review

Prepare and preflight a read-only reviewer:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/independent-review.ts" <TASK_ID> --prepare
node "$ACLH_RUNTIME_ROOT/.harness/scripts/task-status.ts" <TASK_ID> --review-ready --json
```

Dispatch a fresh Codex context/human only when `review_ready` is true. L3 requires
a human. Reviewer writes only `independent-review.json` using:

- `READY` — no findings;
- `READY_WITH_FINDINGS` — non-blocking findings;
- `NOT_READY` — at least one blocking finding.

Every finding has category `defect|risk|edge-case|optimization|question`, severity
`blocking|major|minor|suggestion`, evidence, and a recommendation. Reviewer never
modifies Builder artifacts or starts Repair.

Verify Review, then report implementation, tests, verdict, and findings to the
user. Stop even when verdict is `NOT_READY`:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/independent-review.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/task-status.ts" <TASK_ID> --json
```

Expected next action is `report-review-and-await-user`.

## 5. Explicit user decision

Only after the user responds:

```bash
# User accepts the reviewed result without Repair
node "$ACLH_RUNTIME_ROOT/.harness/scripts/review-decision.ts" <TASK_ID> --accept
node "$ACLH_RUNTIME_ROOT/.harness/scripts/delivery-gate.ts" <TASK_ID>

# User requests Repair of all or selected finding IDs
node "$ACLH_RUNTIME_ROOT/.harness/scripts/review-decision.ts" <TASK_ID> --repair all
node "$ACLH_RUNTIME_ROOT/.harness/scripts/review-decision.ts" <TASK_ID> --repair <FINDING_ID>...
```

Repair is a new Builder cycle: add regression coverage when appropriate, modify
only user-selected scope, refresh Context/Evidence, and request a new independent
Review. Never turn Review output into automatic code changes.

At continuation boundaries use `task-status.ts <TASK_ID> --json`, follow its
bounded `next_action`, and inspect only failed artifacts.
