# Change Summary

Add a compact read-only lifecycle status/preflight, enforce reviewer role
boundaries in the generated packet, reduce Adapter/packet duplication and split
experiment Token accounting by valid work versus waste.

# Affected Modules

- `.harness/scripts/task-status.ts` and review snapshot/runtime helpers;
- self-review and independent-review packet generators;
- `.agents/skills/aclh-task` orchestration contract;
- external capability manifest and Codex attachment tests;
- experiment controller/reporting outside this Engine repository.

# Cross-boundary Impact

The status command executes Engine-owned verifiers against both embedded and
external consumer roots. Consumer repositories receive task artifacts only; they
still do not receive Runtime implementation. Existing command entry points and
Evidence/review schema remain unchanged.

# Verification Scope

- embedded typecheck and full repository test suite;
- external L2 lifecycle from initialization through delivery;
- external L1 self-review and L2/L3 independent-review fixtures;
- Codex attach/detach contract;
- experiment controller category and preflight tests;
- fresh paired PL-01 replay for the empirical Token target.
