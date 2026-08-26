# Specification — Spec-first, user-controlled review lifecycle

Task: `TASK-TOKEN-EFFICIENT-ORCHESTRATION`

## Problem

The optimized external ACLH lifecycle reduced orchestration cost, but the paired
Pocket Ledger replay exposed two product-level workflow defects:

1. task planning was represented by a shallow `spec.md` plus scattered generic
   task artifacts, so the Builder did not visibly refine the request before coding;
2. an independent `REJECT` automatically led orchestration toward Repair even
   though review findings may be defects, risks, edge cases, questions, or optional
   improvements that the user should evaluate first.

Builder self-review also consumed work without providing the independent trust the
user expects. Independent review, not Builder self-review, is the required semantic
check for non-trivial development.

The later expiry-tracker dual run isolated a further cost concentration: product
implementation was close to baseline, while pre-code governance and post-code
finalization created most additional model turns and cached-context replay. The
Adapter also exposed an unconditional browser command and insufficient artifact
schemas, causing agents to inspect Runtime documentation/source to infer formats.

## User Scenarios

### Refine a request before implementation

Given a non-trivial engineering request, the Builder creates a detailed
`spec.md`, a technical `plan.md`, and an ordered `tasks.md` before implementation.
The documents make behavior, boundaries, architecture, contracts, dependencies,
and verification visible rather than simply restating the prompt.

### Inspect an implementation independently

After implementation and required machine verification, a fresh reviewer checks
the repository without modifying Builder-owned files. The reviewer classifies each
finding and reports whether the result is ready, ready with findings, or not ready.

### Decide whether to repair

After review, ACLH reports the implementation and findings, then stops. It must not
repair anything until the user explicitly accepts the reviewed result or requests
Repair. The user may accept optional findings or request all/a subset for repair.

## Functional Requirements

- New tasks declare the `spec-plan-tasks-v1` planning contract and initialize
  `spec.md`, `plan.md`, and `tasks.md` templates.
- A machine planning verifier checks required document sections and rejects
  untouched placeholders before implementation Evidence can be accepted.
- The external task contract and Adapter expose the ordered
  `spec -> plan -> tasks -> build -> test -> independent review` lifecycle.
- Builder self-review remains available for compatibility but is not a default
  delivery prerequisite.
- L1 and L2 tasks require a fresh Codex or human independent reviewer; L3 requires
  a human reviewer. L0 remains exempt for mechanical changes.
- Independent review uses `READY`, `READY_WITH_FINDINGS`, or `NOT_READY` and
  classifies findings as defect, risk, edge case, optimization, or question.
- Review verification validates identity, freshness, disposition, and finding
  structure without treating every finding as a failed review protocol.
- After a valid independent review, task status requires a user decision and does
  not select Repair automatically.
- A user decision is stored in a snapshot-bound task artifact. Only explicit
  `accept` permits Delivery; explicit `repair` permits Builder changes.
- `task-contract.ts --json` publishes valid, bounded authoring shapes for
  Classification, Skill Plan, Verification Gaps, and Skill output discovery.
- The normal Adapter path must not require Runtime README, test, or source
  inspection to learn task artifact formats.
- Browser verification is opt-in and runs only when a task explicitly declares a
  browser machine proof.
- One bounded Builder finalization command refreshes Context, runs the required
  gates/proofs, and returns Builder readiness without model-visible command noise.
- An authorized Repair archives the old Review round so a completed repair can
  proceed to a fresh independent Review.

## Acceptance Criteria

- [ ] A newly initialized task contains authored templates for `spec.md`,
      `plan.md`, and `tasks.md`, plus a planning contract in `.state.yaml`.
- [ ] Planning verification fails for untouched templates and passes for detailed
      documents satisfying the required section contract.
- [ ] Task status blocks implementation Evidence until planning is complete.
- [ ] L2 reaches independent review without requiring `self-review.json`.
- [ ] A valid `READY_WITH_FINDINGS` review completes independent review and causes
      the next action to be `report-review-and-await-user`.
- [ ] A valid `NOT_READY` review is reported without automatically initiating
      Repair.
- [ ] Delivery is blocked until the user explicitly accepts the current review.
- [ ] Repair authorization is recorded only after an explicit user request and can
      identify selected finding IDs.
- [ ] Reviewer write scope remains limited to `independent-review.json`.
- [ ] Existing task entry points remain available and legacy tasks without the new
      planning declaration remain readable.
- [ ] The bootstrap contract contains valid artifact examples and explicitly says
      normal orchestration must not inspect Runtime source.
- [ ] A complete external task without `test:browser` reaches Builder-ready and
      records browser verification as skipped.
- [ ] Browser verification still runs when an explicit browser proof is declared.
- [ ] Builder finalization is a single Adapter-visible command with bounded JSON.
- [ ] Repair authorization rotates the old Review and no longer dead-ends the next
      Review cycle.

## Edge Cases

- A review with no findings must use `READY`.
- A review with non-blocking findings must use `READY_WITH_FINDINGS`.
- A blocking finding must use `NOT_READY`.
- A user decision becomes stale when the review record or reviewed repository
  snapshot changes.
- Product changes made during an authorized Repair invalidate prior Evidence and
  independent review, requiring a new verification/review cycle.
- Absence of a browser proof declaration must not require a `test:browser` script.
- A fresh dual-agent replay is required before claiming a Token-ratio improvement;
  structural round-trip reductions alone are not reported as measured savings.
- Review findings are recommendations until their severity and evidence show a
  violated acceptance criterion or blocking defect.

## Out of Scope

- Automatically choosing which findings to repair.
- Automatically changing product code from reviewer output.
- Replacing canonical machine Evidence with review statements.
- Semantic scoring of prose quality beyond a deterministic minimum document
  structure and placeholder check.

## Compatibility Constraints

- Runtime remains external to consumer repositories.
- Existing scripts and legacy task records remain supported where practical.
- Machine Evidence remains the canonical machine PASS system.
- Historical `self-review.ts` remains callable but is no longer a default gate.
