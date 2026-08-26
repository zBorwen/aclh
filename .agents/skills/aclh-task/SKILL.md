---
name: aclh-task
description: Run an explicitly requested repository task through ACLH specification, implementation, verification, independent review, and user-controlled delivery.
---

# ACLH Task

Act as the thin Codex adapter for this repository's ACLH Runtime. Executable
Runtime commands are authoritative; do not manufacture PASS states.

## Operating rules

1. Follow repository `AGENTS.md` and load bounded bootstrap choices with
   `task-contract.ts --json`.
2. Use `task-status.ts <TASK_ID> --json` for continuation and the exact artifact
   shapes from `task-contract.ts --json`; do not rediscover them from Runtime
   source, tests, or README files.
3. Assess routine risk, verification strategy, Classification, and minimal explicit
   Skills from the request and repository without asking the user to operate ACLH.
4. Classification must not mechanically map to a fixed Skill set.
5. Author `spec.md -> plan.md -> tasks.md` before implementation; refine the
   request rather than restating it.
6. Builder self-review is optional. A fresh independent reviewer is the semantic
   trust boundary and may write only `independent-review.json`.
7. After Review, report findings and stop. Run Repair or acceptance commands only
   after explicit user direction.

Follow `references/lifecycle.md`. Before reviewer dispatch require an exit-zero
`review_ready: true` from:

```bash
node .harness/scripts/task-status.ts <TASK_ID> --review-ready --json
```
