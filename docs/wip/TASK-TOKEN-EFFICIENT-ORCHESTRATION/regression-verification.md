# Regression Scenarios

- An initialized P3 task reports Classification as the first actionable failure.
- Stale Context suppresses unrelated downstream failure noise.
- A complete external L2 Builder state requires packet preparation before review.
- A fresh packet allows reviewer dispatch; a completed independent review points
  to Delivery Gate.
- Review packets preserve snapshot identity while referencing source artifacts.
- Existing L3 human-review enforcement remains unchanged.

# Observable Behavior

`task-status.ts --json` is read-only and bounded. `--review-ready` exits zero only
when a separate reviewer can legally start. Compact packets contain snapshot,
instructions, role boundary and source paths without document-body duplication.

# Test Coverage

- `tests/p4-external-delivery.test.ts`
- `tests/p4-external-self-review.test.ts`
- `tests/p4-external-independent-review.test.ts`
- `tests/codex-adapter.test.ts`
- `tests/p4-codex-plug.test.ts`
- experiment `controller/*.test.mjs`

# Evidence

Targeted RED/GREEN runs are recorded in the task test plan. Final canonical check,
typecheck and test Evidence will be recorded after all governed content is stable.
