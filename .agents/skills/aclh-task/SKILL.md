---
name: aclh-task
description: Run one repository task through the ACLH governed lifecycle from a natural-language engineering request. Use only when explicitly invoked for a full ACLH task; do not use for casual questions or tiny edits that were not explicitly routed through ACLH.
---

# ACLH Task

Act as the thin Codex adapter for the repository-owned ACLH Runtime. Do not reimplement Runtime validation in this Skill and do not manufacture PASS states.

## Input

Treat the text following `$aclh-task` as the engineering task intent. The user may optionally include an explicit task ID.

## Operating rules

1. Read repository `AGENTS.md`, `.harness/governance.yaml`, and `.harness/SKILLS.md` before mutating the repository.
2. Use `.harness/scripts/*` as the source of executable truth. If this Skill conflicts with executable Harness behavior, report the mismatch and follow the stricter repository contract.
3. Do not ask the user to choose `risk`, `verification_strategy`, Classification, or Engineering Skills during routine bootstrap. Assess them from the request and repository context, record the rationale, and proceed.
4. Classification describes the task; it must not mechanically map to a fixed Skill set. Author `selected` Skills explicitly from the available `.harness/skills/*.yaml` catalog and never invent missing Skills.
5. Keep implementation ownership with the Builder. ACLH Engineering Skills structure understanding and verification; they are not Codex-native subagents.
6. Preserve P1 trust boundaries. Builder self-review is not independent review. Never create a same-session independent PASS.
7. Prefer the smallest safe diff and do not broaden scope merely because ACLH is active.

## Run the lifecycle

Follow `references/lifecycle.md` in order. In summary:

1. Understand the task before bootstrap and derive a short task ID when none was supplied.
2. Ensure a safe task branch/worktree state.
3. Assess Classification, risk level, and the current P2 compatibility verification strategy.
4. Run `init-task.ts` with the assessed risk and strategy.
5. Persist and verify `classification.yaml`.
6. Explicitly author `skill-plan.yaml`; resolve and verify it with the Runtime.
7. Generate Skill-aware Context.
8. Present a concise bootstrap summary, then continue implementation without requiring routine confirmation.
9. Complete implementation, verification-plan markers, and resolved Skill output artifacts.
10. Regenerate Skill-aware Context after governed content stabilizes.
11. Record only the canonical machine Evidence required by risk plus selected verification Skills.
12. Run required self-review and delivery checks.
13. For L2/L3, prepare Independent Review and stop at the independent-review boundary unless a genuinely separate reviewer context/human has supplied the review artifact.

## User-visible progress

Keep updates compact. Surface only decisions that materially affect the task: task ID/branch, Classification, risk/strategy, selected Skills, important ambiguities, verification failures, and final delivery/review status.

Do not make the user manually execute ACLH internal scripts unless the Runtime itself cannot proceed and manual intervention is genuinely required.
