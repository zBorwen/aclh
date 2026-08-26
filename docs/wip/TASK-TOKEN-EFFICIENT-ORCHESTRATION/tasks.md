# Tasks — Spec-first, user-controlled review lifecycle

## Implementation Tasks

- [x] Add Spec Kit-style `spec.md`, `plan.md`, and `tasks.md` templates.
- [x] Add a task planning verifier and planning declaration for newly initialized tasks.
- [x] Publish planning requirements through task contract, task status, Delivery,
      external capabilities, and the Codex Adapter.
- [x] Remove Builder self-review from default L1-L3 delivery policy while retaining
      the compatibility command.
- [x] Require independent Review for L1/L2 and human Review for L3.
- [x] Add Review v1.1 dispositions and typed finding validation.
- [x] Add a snapshot-bound user Review decision artifact and command.
- [x] Stop task orchestration after Review until the user accepts or requests Repair.
- [x] Update repository governance documentation and installed Adapter artifacts.
- [x] Publish exact bootstrap artifact shapes through `task-contract --json`.
- [x] Make browser verification an explicit Verification Gap opt-in.
- [x] Add one bounded `builder-finalize.ts` command and use it in both Adapter
      lifecycle variants.
- [x] Rotate repaired Review rounds and preserve selected Repair authorization.
- [x] Delete the unreferenced historical `TASK-CODEX-ADAPTER-SELF-REVIEW` package.
- [ ] Refresh formal task Context, Evidence, and independent Review.

## Dependencies

1. Planning templates define the verifier contract.
2. Planning verifier lands before task status and Delivery integration.
3. Review v1.1 lands before user decision binding.
4. Review decision binding lands before the task-status waiting state and Delivery gate.
5. Runtime behavior stabilizes before Adapter documentation and final Evidence.

## Verification Tasks

- [x] RED: untouched planning templates fail and authored documents pass.
- [x] RED: Review with findings completes review but cannot trigger Repair or Delivery
      without an explicit user decision.
- [x] RED: stale or invalid review decisions are rejected.
- [x] GREEN: external L2 lifecycle reaches `report-review-and-await-user` without
      Builder self-review and delivers only after `review-decision --accept`.
- [x] REFACTOR: full repository tests and external Adapter size contract pass.
- [x] RED/GREEN: an external consumer without `test:browser` finalizes with
      `browser=not-required` and no browser proof artifact.
- [x] RED/GREEN: a Repair decision vacates the active Review slot, archives the
      prior round, and exposes `repair-user-selected-findings`.

## Acceptance Mapping

- Planning artifacts and verifier cover specification depth and pre-build ordering.
- Review v1.1 covers defects, risks, edge cases, optimizations, and questions.
- Review decision runtime covers the user-controlled accept/repair boundary.
- Task status and Delivery tests prove Repair is never selected automatically.
