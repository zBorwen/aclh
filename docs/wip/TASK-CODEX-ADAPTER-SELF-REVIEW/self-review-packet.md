# Builder Self-Review Packet — TASK-CODEX-ADAPTER-SELF-REVIEW

Repository snapshot:
- commit: a9454f0af02671de5f4816ea966ee125e717935f
- worktree: 16d37a1755932aa265122c47823acc30ccc13811cc301fb64631b7cbdaf4c79c

Answer every hostile question after canonical machine Evidence has completed. Record the result in self-review.json with version=1.0, this task_id, this exact repository snapshot, run_at, gaps_found, root_fix_tracked, notes, and answers Q1-Q10. Then run self-review.ts TASK-CODEX-ADAPTER-SELF-REVIEW --verify.

## Hostile Questions

- Q1  What did I miss? What did I overlook? (boundary cases, error paths, empty/null inputs, state transitions, concurrency)
- Q2  Which of my assumptions could be wrong? Would a stricter reviewer reject them first?
- Q3  Which acceptance criterion or constraint from the spec did I NOT re-verify?
- Q4  Which callers / dependents / consumers of this change went untested?
- Q5  Did I patch a symptom instead of the root cause? Is the root-fix direction tracked as the end state (AGENTS.md B2/B3)?
- Q6  Which of my tests could pass for the wrong reason?
- Q7  Which state transition in .state.yaml is unhandled (phase/status/review_history)?
- Q8  What did I leave undocumented or unexplained in changelog.md?
- Q9  Is the diff minimal, or did I drag in unrelated changes for convenience?
- Q10 Did I run the machine gates (check.ts + lint + tests) and confirm they are green?

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
- [x] A source mutation makes self-review verification fail.
- [x] Full external L2 delivery accepts the fresh review and Independent Review.
- [x] Full serial repository suite passes.
- [x] Canonical `npm test` uses serial execution; the prior parallel command reproduced 12 repository-snapshot races.
- [x] issue-management Adapter exercise reaches its policy boundary: identity, readiness, Scope, Context, verification plan and Skill outputs pass; Gap Registry blocks on missing canonical browser proof.

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

