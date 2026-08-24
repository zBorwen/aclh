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
