# Tasks — Token-efficient Codex orchestration

## RED

- [x] Add status-command tests for Builder-ready, review-ready, stale and missing
      artifact states.
- [x] Add a reviewer preflight regression proving stale Builder state cannot enter
      independent review.
- [x] Add reporting tests proving protocol violations are visible as waste but do
      not contaminate valid-workflow totals.
- [x] Add compact-packet contract tests before changing packet generation.

## GREEN

- [x] Implement the machine-readable task status and review-readiness command.
- [x] Publish the command through external capabilities and the Codex Adapter.
- [x] Add role-boundary metadata/instructions for Builder and Reviewer dispatch.
- [x] Implement layered experiment totals and per-stage diagnostics.
- [x] Replace duplicated packet bodies with bounded summaries and source paths.

## REFACTOR

- [x] Remove lifecycle prose made redundant by authoritative Runtime status.
- [x] Share freshness/readiness helpers instead of duplicating snapshot logic.
- [x] Run canonical repository gates and an external-consumer lifecycle fixture (104/104 tests).
- [ ] Replay PL-01 with visible Luna/high subagents and compare against the stored
      pre-optimization result.

## Boundaries

- Runtime implementation: this repository.
- Experiment controller/results: `/Users/hylas/Documents/workspace/pocket-ledger-experiment`.
- Product test repositories are measurement subjects and must not receive Runtime
  implementation files.

## Verification Strategy

strategy: tdd

- [ ] RED: new status, preflight, packet and reporting contracts fail first.
- [ ] GREEN: minimal Runtime/controller changes satisfy those contracts.
- [ ] REFACTOR: full compatibility suite and paired replay remain green.
