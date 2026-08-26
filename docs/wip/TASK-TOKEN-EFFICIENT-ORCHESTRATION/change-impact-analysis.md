# Change Summary

Add a Spec Kit-style planning boundary, retain compact read-only lifecycle status,
replace mandatory Builder self-review with independent Review, classify Review
findings, and require an explicit user decision before Delivery or Repair.
Also make bootstrap artifacts self-describing, collapse post-build orchestration
into one bounded Runtime command, make browser verification opt-in, and rotate
completed Review rounds during authorized Repair.

# Affected Modules

- `.harness/scripts/task-status.ts` and review snapshot/runtime helpers;
- planning templates/verifier and task initialization;
- independent-review packet/schema and user review-decision runtime;
- `.agents/skills/aclh-task` orchestration contract;
- external capability manifest and Codex attachment tests;
- experiment controller/reporting outside this Engine repository.
- `.harness/scripts/builder-finalize.ts`, task contract authoring schemas, browser
  Verification Gap handling, and Repair history/authorization artifacts.

# Cross-boundary Impact

The status command executes Engine-owned verifiers against both embedded and
external consumer roots. Consumer repositories receive planning, Evidence, Review,
and decision artifacts only; Runtime implementation remains external. Review v1.1
adds typed dispositions while legacy v1.0 records remain readable.

# Verification Scope

- embedded typecheck and full repository test suite;
- external L2 lifecycle from initialization through delivery;
- external planning, L1/L2/L3 independent-review, and explicit decision fixtures;
- Codex attach/detach contract;
- experiment controller category and preflight tests;
- fresh paired PL-01 replay for the empirical Token target.
- external no-browser Builder finalization and Repair-to-next-review transition.
