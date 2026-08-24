# Observed Symptom

New L1-L3 Adapter tasks reached the review step with `phase: requirements` and blank self-review fields. Running `self-review.ts` failed; editing `.state.yaml` after Evidence made Evidence stale. Separately, a previously populated record could be reused after a later repository change.

# Reproduction

The RED test invoked `self-review.ts <TASK_ID> --prepare` on a freshly initialized external L1 consumer. The old CLI ignored the mode and reported 14 missing state/review checks. Historical validation PR #38 also demonstrated that a pre-handoff inline review could survive a refreshed Evidence pass.

# Root Cause

Builder self-review was modeled as mutable inline task state without a Runtime recording transition or repository fingerprint. Adapter orchestration therefore had no valid order that both populated review and preserved Evidence freshness, and Delivery could only validate structure—not review freshness.

# Affected Scope

- Self-review CLI and task-state template.
- Evidence output exclusions.
- Delivery and Resync review gates.
- Embedded and external Codex Adapter lifecycle instructions.
- External self-review and complete-delivery tests.

# Evidence

- RED: `tests/p4-external-self-review.test.ts` failed before implementation.
- GREEN: targeted Adapter/self-review/external-delivery tests pass.
- Full suite: 103/103 tests pass serially after implementation.
