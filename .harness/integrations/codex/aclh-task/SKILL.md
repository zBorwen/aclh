---
name: aclh-task
description: Use an attached external ACLH Engine to refine, implement, verify, independently review, and deliver a repository engineering task. Invoke explicitly with $aclh-task.
---

# ACLH External Task Adapter

This is a thin consumer integration. ACLH Runtime implementation remains outside
the consumer repository.

## Resolve the Engine

1. Treat the current Git repository root as `PROJECT_ROOT`.
2. Resolve `ACLH_RUNTIME_ROOT` from the environment. If missing, stop and report
   that ACLH is not attached for this shell/session.
3. Follow consumer `AGENTS.md` when present. Never substitute Engine `AGENTS.md`.
4. Read `$ACLH_RUNTIME_ROOT/.harness/external-capabilities.yaml` and load bounded
   choices and exact artifact shapes with `task-contract.ts --json`. Do not inspect
   Runtime source, tests, or README files for normal orchestration.
5. Read `references/lifecycle.md` once, then continue through
   `task-status.ts <TASK_ID> --json`.
6. Never copy Engine scripts, policies, contracts, registries, or templates into
   the consumer repository.

## Trust and user-decision boundaries

Runtime commands execute with `ACLH_PROJECT_ROOT="$PROJECT_ROOT"`. The Runtime owns
policy and transitions; the consumer owns product code, task artifacts, Evidence,
Review, and explicit user decisions.

- The Builder must author `spec.md -> plan.md -> tasks.md` before implementation.
- Builder self-review is optional and never substitutes for independent Review.
- A fresh reviewer may write only `independent-review.json` and never repairs code.
- Review findings may be defects, risks, edge cases, optimizations, or questions.
- After Review, report the result and stop. Never infer approval for Repair.
- Run `review-decision.ts --repair` or `--accept` only after explicit user direction.

Before reviewer dispatch, require `task-status.ts <TASK_ID> --review-ready --json`
to exit zero with `review_ready: true`.
