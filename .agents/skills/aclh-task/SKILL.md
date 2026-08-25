---
name: aclh-task
description: Run one repository task through the ACLH governed lifecycle from a natural-language engineering request. Use only when explicitly invoked for a full ACLH task; do not use for casual questions or tiny edits that were not explicitly routed through ACLH.
---

# ACLH Task

Act as the thin Codex adapter for the repository-owned ACLH Runtime. Do not reimplement Runtime validation in this Skill and do not manufacture PASS states.

## Input

Treat the text following `$aclh-task` as the engineering task intent. The user may optionally include an explicit task ID.

## Operating rules

1. Follow `PROJECT_ROOT/AGENTS.md` when present. An embedded Engine repository may require its local governance files. For a thin external consumer, do not substitute Engine `AGENTS.md` for a missing project file; load bounded bootstrap choices with `task-contract.ts --json`.
2. Use `.harness/scripts/*` as executable truth. After task initialization, run `task-status.ts <TASK_ID> --json` to identify the next action; do not inspect Runtime source to reconstruct state unless a reported Runtime defect itself is under investigation.
3. Do not ask the user to choose `risk`, `verification_strategy`, Classification, or Engineering Skills during routine bootstrap. Assess them from the request and repository context, record the rationale, and proceed.
4. Classification describes the task; it must not mechanically map to a fixed Skill set. Author `selected` Skills explicitly from the available `.harness/skills/*.yaml` catalog and never invent missing Skills.
5. Keep implementation ownership with the Builder. ACLH Engineering Skills structure understanding and verification; they are not Codex-native subagents.
6. Preserve P1 trust boundaries. Builder self-review is not independent review. Never create a same-session independent PASS.
7. Prefer the smallest safe diff and do not broaden scope merely because ACLH is active.

## Run the lifecycle

Follow `references/lifecycle.md`. Bootstrap once, then use compact Runtime status
instead of rereading every contract:

```bash
node .harness/scripts/task-contract.ts --json
node .harness/scripts/task-status.ts <TASK_ID> --json
```

Before dispatching L2/L3 Independent Review, require:

```bash
node .harness/scripts/task-status.ts <TASK_ID> --review-ready --json
```

Only an exit-zero `review_ready: true` permits reviewer dispatch. The reviewer may
write only `independent-review.json`; stale Builder prerequisites return to the
Builder.

## User-visible progress

Keep updates compact. Surface only decisions that materially affect the task: task ID/branch, Classification, risk/strategy, selected Skills, important ambiguities, verification failures, and final delivery/review status.

Do not make the user manually execute ACLH internal scripts unless the Runtime itself cannot proceed and manual intervention is genuinely required.
