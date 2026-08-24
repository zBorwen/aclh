# Tasks — Snapshot-bound Builder Self-Review

## RED

- [x] Add an external-consumer regression test that expects `--prepare`, a snapshot-bound `self-review.json`, Evidence stability, and stale-review rejection.
- [x] Record the pre-fix failure: `--prepare` fell through to the old validator and failed on blank inline state.

## GREEN

- [x] Add Runtime-owned self-review prepare and verify modes.
- [x] Exclude self-review semantic outputs from canonical Evidence freshness.
- [x] Make Delivery Gate explicitly verify the snapshot-bound review.
- [x] Update Resync to request refresh when a review artifact exists.
- [x] Update embedded/external Adapter lifecycle instructions.
- [x] Replace external-delivery test state mutation with the real lifecycle.

## REFACTOR

- [x] Replace inline self-review template fields with packet/record references.
- [x] Preserve no-mode verification compatibility for existing CLI callers.
- [x] Run the complete serial repository test suite.
- [x] Exercise the completed Adapter lifecycle against `agent/issue-management` and stop honestly at its uncovered browser-proof boundary.

## Review Boundary

- [ ] Complete snapshot-bound Builder self-review for this task.
- [ ] Prepare fresh independent review required by L2.
