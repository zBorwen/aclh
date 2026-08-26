# Regression Scenarios

- An initialized P3 task reports Classification as the first actionable failure.
- Stale Context suppresses unrelated downstream failure noise.
- A complete external L2 Builder state requires packet preparation before review.
- A fresh packet allows reviewer dispatch; a completed independent Review points
  to `report-review-and-await-user`, never automatic Repair or Delivery.
- Untouched planning templates block before implementation Evidence.
- `READY_WITH_FINDINGS` and `NOT_READY` are valid completed Review reports.
- Delivery requires an explicit accepted decision; Repair requires explicitly
  selected finding IDs.
- Review packets preserve snapshot identity while referencing source artifacts.
- Existing L3 human-review enforcement remains unchanged.
- A task with no browser proof and no `test:browser` script reaches Builder-ready.
- A task that explicitly declares `machine_proofs: [browser]` retains browser proof
  enforcement.
- Repair archives the old Review, exposes the selected repair state, and allows a
  later finalized Builder cycle to prepare a fresh Review.

# Observable Behavior

`task-status.ts --json` is read-only and bounded. `--review-ready` exits zero only
when a separate reviewer can legally start. Compact packets contain snapshot,
instructions, role boundary and source paths without document-body duplication.

# Test Coverage

- `tests/p4-external-delivery.test.ts`
- `tests/p4-external-self-review.test.ts`
- `tests/p4-external-independent-review.test.ts`
- `tests/task-planning.test.ts`
- `tests/review-decision.test.ts`
- `tests/codex-adapter.test.ts`
- `tests/p4-codex-plug.test.ts`
- `tests/task-contract.test.ts`
- experiment `controller/*.test.mjs`

# Evidence

Targeted RED/GREEN runs are recorded in the task test plan. Final canonical check,
typecheck and test Evidence will be refreshed after governed content is stable.
