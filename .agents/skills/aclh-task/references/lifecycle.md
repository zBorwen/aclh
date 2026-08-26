# ACLH Task Adapter Lifecycle

Use `task-status.ts` for current state and this reference for semantic boundaries.

## 1. Bootstrap and planning

Inspect Git state, preserve unrelated work, initialize a dedicated task, validate
Classification/Skill Plan, and generate bounded Context. New tasks must then author
the Spec Kit-style planning sequence:

```bash
node .harness/scripts/task-contract.ts --json
node .harness/scripts/init-task.ts <TASK_ID> --risk <LEVEL> --strategy <STRATEGY>
node .harness/scripts/classification.ts <TASK_ID> --verify
node .harness/scripts/skill-plan.ts <TASK_ID> --resolve
node .harness/scripts/skill-plan.ts <TASK_ID> --verify
node .harness/scripts/context-select.ts <TASK_ID> --generate
node .harness/scripts/context-select.ts <TASK_ID> --verify
node .harness/scripts/task-planning.ts <TASK_ID> --verify
```

Do not write `resolved` manually; the Runtime owns Skill dependency ordering.
Use the self-describing `task-contract.ts --json` shapes; do not read Runtime
source, tests, or README files to discover artifact formats.
`spec.md` captures user behavior and boundaries, `plan.md` captures architecture
and contracts, and `tasks.md` captures ordered implementation/verification work.
Do not begin implementation while placeholders remain.

## 2. Build and machine verification

Implement the smallest root fix and complete task/Skill outputs. After governed
content stabilizes, use the bounded Builder finalizer:

```bash
node .harness/scripts/builder-finalize.ts <TASK_ID> --json
```

Browser verification is opt-in and runs only when `verification-gaps.yaml`
explicitly declares `machine_proofs: [browser]`. Small tasks omit it.
Builder self-review is available but not a default delivery gate.

## 3. Read-only Independent Review

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --prepare
node .harness/scripts/task-status.ts <TASK_ID> --review-ready --json
```

Only `review_ready: true` permits a fresh Codex/human reviewer. Reviewer writes
only `independent-review.json`, classifies findings, and uses `READY`,
`READY_WITH_FINDINGS`, or `NOT_READY`. It never changes product code, Builder
artifacts, Context, or Evidence.

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --verify
node .harness/scripts/task-status.ts <TASK_ID> --json
```

Report the result and stop at `report-review-and-await-user`. A finding is not
automatic authorization to Repair.

## 4. User-controlled continuation

Only after explicit user direction:

```bash
node .harness/scripts/review-decision.ts <TASK_ID> --accept
node .harness/scripts/delivery-gate.ts <TASK_ID>

node .harness/scripts/review-decision.ts <TASK_ID> --repair all
node .harness/scripts/review-decision.ts <TASK_ID> --repair <FINDING_ID>...
```

An authorized Repair invalidates prior verification and starts another
Builder/Review cycle. Never infer acceptance or repair scope.
