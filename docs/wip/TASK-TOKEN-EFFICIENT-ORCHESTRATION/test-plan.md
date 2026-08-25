# Test Plan — Token-efficient Codex orchestration

## Runtime contract tests

- [x] Status JSON identifies the exact next action for an initialized task.
- [x] Status JSON reports stale/missing Context, Evidence and reviews.
- [x] `review_ready` is false until all Builder-owned prerequisites pass.
- [x] `review_ready` is true for a complete external L2 fixture.
- [x] Existing delivery-gate and independent-review commands remain compatible.

## Adapter tests

- [x] The thin consumer Skill points Codex to status/preflight before reading
      detailed lifecycle material.
- [x] Builder and Reviewer write boundaries are explicit.
- [x] The compact lifecycle still includes bootstrap, repair and delivery paths.

## Experiment reporting tests

- [x] Completed/rejected/repair sessions contribute to valid workflow totals.
- [x] Protocol violations contribute to observed and waste totals only.
- [x] Aborted setup attempts remain separately visible.
- [x] Reports include stage/session counts, cached input, uncached input, output and
      total Token fields.

## Replay verification

- [ ] Recreate paired PL-01 subjects from the documented seed commits.
- [ ] Use identical product requirements and Luna/high visible subagents.
- [ ] Record all prompts in the user's short, direct Chinese voice.
- [ ] Confirm zero protocol violations.
- [ ] Compare observed and valid ACLH ratios against the 3x target and 4x failure
      threshold.

## Verification Strategy

strategy: tdd

- [x] RED: missing status command and duplicated packet bodies failed the new Runtime tests; old reporting failed category separation.
- [x] GREEN: targeted Runtime and controller tests pass after the minimal implementation.
- [ ] REFACTOR: full repository verification passes (104/104); paired replay remains.
