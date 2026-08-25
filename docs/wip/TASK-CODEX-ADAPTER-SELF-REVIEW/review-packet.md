# Independent Review Packet — TASK-CODEX-ADAPTER-SELF-REVIEW

Repository snapshot:
- commit: a9ddca8777a5ca906095e2b39fa3e26e5075d5fc
- worktree: 0d0f7eb50b62e52d73cb4cd3a0bdf5e8a5f864635a776dd9c188282affa07bbe

Review this task in a FRESH Codex context or use a human reviewer. Do not reuse the builder conversation. Challenge correctness, acceptance criteria, regressions, root-cause quality, and test adequacy. Record the result in independent-review.json with a reviewer session id distinct from the builder session id, verdict=PASS|REJECT, findings as an array, and this exact repository snapshot.

## spec.md

# Specification — Snapshot-bound Builder Self-Review

Task: `TASK-CODEX-ADAPTER-SELF-REVIEW`

## Background

The Codex Adapter told L1-L3 builders to run `self-review.ts` after machine Evidence, but the command only validated fields that `init-task.ts` left blank. Manually filling `.state.yaml` after Evidence made that Evidence stale, while an old filled record could later be reused after repository changes.

## Requirements

- Runtime must own the transition into the testing/self-review phase before final Context and Evidence.
- Builder self-review must be a separate semantic artifact rather than an inline mutation of `.state.yaml` after Evidence.
- The review must bind to the exact governed repository snapshot and become stale after a governed change.
- Writing review packet/record outputs must not invalidate canonical machine Evidence.
- Embedded and external Codex Adapter lifecycles must describe the same prepare/record/verify order.

## Acceptance Criteria

- [x] `self-review.ts <TASK_ID> --prepare` transitions an active task to `testing` and emits a packet.
- [x] Repeating `--prepare` in `testing` refreshes the packet without mutating governed task state.
- [x] `self-review.ts <TASK_ID> --verify` requires a complete `self-review.json` bound to the current repository snapshot.
- [x] A governed repository change makes the review stale.
- [x] Recording self-review after canonical Evidence leaves Evidence fresh.
- [x] Recording self-review after final Context leaves embedded Context fresh.
- [x] A complete external L2 consumer delivery passes without manually editing `.state.yaml`.

## Constraints

- Builder self-review remains distinct from Independent Review.
- Existing ACLH Evidence remains the only canonical machine PASS mechanism.
- No consumer Runtime implementation may be copied from the Engine.


## tasks.md

# Tasks — Snapshot-bound Builder Self-Review

## RED

- [x] Add an external-consumer regression test that expects `--prepare`, a snapshot-bound `self-review.json`, Evidence stability, and stale-review rejection.
- [x] Record the pre-fix failure: `--prepare` fell through to the old validator and failed on blank inline state.

## GREEN

- [x] Add Runtime-owned self-review prepare and verify modes.
- [x] Exclude self-review semantic outputs from canonical Evidence freshness.
- [x] Exclude self-review semantic outputs from embedded Context freshness.
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


## test-plan.md

# Test Plan — Snapshot-bound Builder Self-Review

## Scope

- Self-review phase transition and packet generation.
- Review record schema and repository freshness.
- Evidence exclusion behavior.
- Embedded Adapter contract and external L2 delivery compatibility.
- Real issue-management consumer exercise.

## Cases

- [x] `--prepare` transitions `requirements` to `testing`.
- [x] Fresh `self-review.json` passes verification.
- [x] Review outputs do not stale check/typecheck/test Evidence.
- [x] Review outputs do not stale embedded Skill-aware Context.
- [x] A source mutation makes self-review verification fail.
- [x] Full external L2 delivery accepts the fresh review and Independent Review.
- [x] Full serial repository suite passes.
- [x] Canonical `npm test` uses serial execution; the prior parallel command reproduced 12 repository-snapshot races.
- [x] issue-management Adapter exercise reaches its policy boundary: identity, readiness, Scope, Context, verification plan and Skill outputs pass; Gap Registry blocks on missing canonical browser proof.
- [x] Delivery Gate regression exposed and fixed the embedded Context exclusion missed by the external-consumer fixture.

## Verification Strategy

strategy: tdd

- [x] RED: external self-review test failed because the old command could not prepare or record review state.
- [x] GREEN: targeted Adapter, self-review, and external L2 delivery tests pass with the new lifecycle.
- [x] REFACTOR: inline task-state review fields were replaced by packet/record references and the full suite passes.


## changelog.md

# Changelog

- 2026-08-24: Initialized task TASK-CODEX-ADAPTER-SELF-REVIEW (risk L2, strategy tdd, branch agent/codex-adapter-self-review)
- 2026-08-24: Reproduced the missing self-review transition with a failing external-consumer test.
- 2026-08-24: Added prepare/verify self-review lifecycle with snapshot-bound review artifacts.
- 2026-08-24: Updated Adapter orchestration, Delivery/Resync checks, templates, and external lifecycle tests.
- 2026-08-24: Exercised the external Runtime against `agent/issue-management`; core check/typecheck/77 tests/build and Builder browser smoke passed, while the new Gap Registry correctly blocked delivery because the consumer has no `test:browser` or human coverage record.
- 2026-08-24: Made the canonical repository test script serial after the default parallel run reproduced 12 shared-repository snapshot races; the same 103 tests pass serially.
- 2026-08-24: Fixed embedded Context freshness to ignore the same task-local semantic review outputs as Evidence; Delivery Gate had exposed the omission after a real Builder review.

