# Regression Scenarios

- Fresh L1/L2 task can enter testing without hand-editing `.state.yaml`.
- Self-review recorded after Evidence does not stale Evidence.
- Source changes after review invalidate self-review.
- External L2 Delivery still enforces Independent Review after Builder review.

# Observable Behavior

CLI prepare emits a packet and phase transition; verify prints PASS only for a complete record matching the current repository snapshot. Delivery fails when that review is missing or stale.

# Test Coverage

- `tests/p4-external-self-review.test.ts`
- `tests/p4-external-delivery.test.ts`
- `tests/codex-adapter.test.ts`
- Full `tests/*.test.ts` serial run

# Evidence

Canonical `test` Evidence is required by this verification Skill; L2 additionally requires check and typecheck.
