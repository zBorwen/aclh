# Test Plan — Token-efficient Codex orchestration

## Runtime contract tests

- [x] Status JSON identifies the exact next action for an initialized task.
- [x] Status JSON reports stale/missing Context, Evidence and reviews.
- [x] `review_ready` is false until all Builder-owned prerequisites pass.
- [x] `review_ready` is true for a complete external L2 fixture.
- [x] Existing delivery-gate and independent-review commands remain compatible.
- [x] Untouched planning templates fail and authored `spec.md`, `plan.md`, and
      `tasks.md` pass before implementation Evidence.
- [x] Review v1.1 validates typed findings and all three dispositions.
- [x] Review completion stops at `report-review-and-await-user`.
- [x] Delivery fails without an explicit accepted Review decision.
- [x] Repair decisions bind all or selected finding IDs to the reviewed snapshot.
- [x] Repair archives the active Review round and exposes an actionable repair state.
- [x] Builder finalization skips browser verification when no browser proof is declared.
- [x] A no-browser external consumer reaches Builder-ready without `test:browser`.

## Adapter tests

- [x] The thin consumer Skill points Codex to status/preflight before reading
      detailed lifecycle material.
- [x] Builder and Reviewer write boundaries are explicit.
- [x] The compact lifecycle requires detailed planning and exposes Repair only
      after explicit user direction.
- [x] Bootstrap artifact shapes are available from one bounded contract response.
- [x] The lifecycle contains no unconditional browser run and uses one Builder
      finalization command.

## Experiment reporting tests

- [x] Completed/rejected/repair sessions contribute to valid workflow totals.
- [x] Protocol violations contribute to observed and waste totals only.
- [x] Aborted setup attempts remain separately visible.
- [x] Reports include stage/session counts, cached input, uncached input, output and
      total Token fields.

## Replay verification

- [x] Recreated paired PL-01 subjects with identical product requirements and
      Luna/high visible subagents.
- [x] Confirmed the optimized Builder/Review path had no protocol-violation session.
- [x] Measured first-delivery Builder cost separately: ACLH 7,545,974 versus
      baseline 3,220,846 tokens (2.34x).
- [x] Classified automatic Repair after Review as the workflow mismatch addressed
      by the user-controlled decision boundary in this change.
- [x] Measured the later expiry-tracker run: baseline 980,822 versus ACLH 5,938,191
      total tokens (6.05x); implementation plus core gates was close to baseline,
      while governance bookends dominated the excess.
- [x] Treat the new round-trip reductions as structural evidence only; no improved
      Token ratio is claimed until another paired replay is run.

## Verification Strategy

strategy: tdd

- [x] RED: missing status command and duplicated packet bodies failed the new Runtime tests; old reporting failed category separation.
- [x] GREEN: planning, Review disposition, Review decision, Adapter, and external
      Delivery tests pass after the Runtime change.
- [x] REFACTOR: full repository verification passes 106/106; canonical Evidence is
      refreshed after all governed content stabilizes.
