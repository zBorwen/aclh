# Specification — Token-efficient Codex orchestration

Task: `TASK-TOKEN-EFFICIENT-ORCHESTRATION`

## Background

The first paired Pocket Ledger experiment measured 1,523,992 baseline tokens and
14,519,949 ACLH tokens. ACLH used six sessions, 97 Builder tool calls and about
192,605 characters of Builder tool output. One reviewer was dispatched before
Builder artifacts were fresh, producing a 3,255,910-token protocol violation.

## Requirements

- Make the next legal lifecycle action machine-readable without requiring Codex
  to rediscover it from Runtime source and long lifecycle documentation.
- Prevent an independent reviewer from being dispatched before Context,
  Evidence, Builder self-review and the review packet are ready.
- Preserve Builder and Independent Reviewer trust boundaries.
- Report observed Token cost separately from valid workflow cost and classify
  orchestration waste without hiding it.
- Reduce repeated lifecycle instructions and packet duplication while keeping
  source artifacts available by path.
- Preserve existing embedded and external Runtime behavior for supported callers.

## Acceptance Criteria

- [x] A Runtime status command returns phase, next action, freshness failures and
      `review_ready` as bounded JSON.
- [x] Review readiness fails before Builder prerequisites are fresh and passes at
      the existing independent-review boundary.
- [x] A reviewer-facing contract explicitly forbids product, Evidence and
      Builder-review mutations.
- [x] Experiment reporting contains observed, valid-workflow and orchestration-
      waste totals, including cached and uncached input fields.
- [x] `protocol-violation` remains visible in observed totals but is excluded from
      valid-workflow totals.
- [x] Adapter lifecycle and generated packets are materially smaller without
      weakening current machine Evidence or review identity checks.
- [x] Existing check, typecheck and repository tests remain green (104/104).
- [ ] A fresh Luna/high PL-01 replay uses no protocol-violation session and targets
      ACLH total Token usage at no more than three times the paired baseline; over
      four times is a failed optimization experiment.

## Compatibility Constraints

- Existing script entry points remain supported unless a migration is documented.
- L2 still requires Builder self-review and fresh-context independent review.
- Machine Evidence remains the only canonical machine PASS system.
- The Runtime remains external to consumer repositories.
