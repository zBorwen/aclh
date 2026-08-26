# Plan — Spec-first, user-controlled review lifecycle

## Technical Context

ACLH owns task initialization, policy, status calculation, Evidence, review packet
generation, review verification, and Delivery. External consumers retain task and
review artifacts while invoking Engine-owned scripts through `ACLH_PROJECT_ROOT`.
The Codex Adapter is intentionally thin and must describe only bounded lifecycle
decisions that are not already machine-readable.

## Architecture

- Add `task-planning.ts` as a deterministic structural verifier for the planning
  contract declared by new task state.
- Add a `plan.md` template and strengthen the existing specification/task
  templates so the Builder has a Spec Kit-style refinement path.
- Extend task status and Delivery to call the planning verifier only for tasks that
  declare the new contract, preserving legacy task compatibility.
- Evolve independent review to a structured disposition plus typed findings while
  keeping repository snapshot and reviewer identity boundaries.
- Add `review-decision.ts` to bind an explicit user `accept` or `repair` decision
  to the exact review record and repository snapshot.
- Keep Reviewer writes limited to `independent-review.json`; the Builder records a
  user decision only after receiving explicit user direction.
- Extend the compact task contract with exact authoring examples so the Adapter
  never needs source/README discovery for normal bootstrap.
- Add `builder-finalize.ts` to execute deterministic post-build transitions inside
  one Runtime process boundary and return one bounded JSON result.
- Derive browser execution exclusively from explicit Verification Gap proof
  declarations; no declaration means no browser command and no browser script.
- Rotate repaired Review rounds into excluded history and retain a short-lived
  repair authorization until Builder finalization succeeds.

## Data Model and Contracts

`.state.yaml` gains:

```yaml
planning:
  contract: spec-plan-tasks-v1
```

Independent Review v1.1 uses:

```json
{
  "verdict": "READY_WITH_FINDINGS",
  "findings": [
    {
      "id": "stable-id",
      "category": "edge-case",
      "severity": "minor",
      "summary": "...",
      "evidence": "...",
      "recommendation": "..."
    }
  ]
}
```

`review-decision.json` records `accept` or `repair`, selected finding IDs, decision
time, repository snapshot, and a SHA-256 binding to `independent-review.json`.

`repair-authorization.json` temporarily carries the selected repair scope, while
`review-history.json` preserves prior Review/decision rounds without occupying the
active Review slot or invalidating machine Evidence.

## Implementation Strategy

1. Add RED tests for initialized planning files, planning validation, review
   dispositions, user-decision gating, and Adapter instructions.
2. Implement planning templates/verifier and publish the command externally.
3. Change governance so independent review replaces mandatory Builder self-review
   for L1-L3.
4. Implement Review v1.1 validation and explicit review-decision runtime.
5. Update task status and Delivery ordering.
6. Update the external Adapter, repository governance documents, and compatibility
   fixtures.
7. Publish self-describing authoring shapes, implement opt-in browser semantics and
   the compact Builder finalizer, then remove unconditional Adapter commands.
8. Rotate old Review rounds on Repair and cover the next-cycle state transition.

## Verification Strategy

- Targeted unit/integration tests cover planning and review-decision state.
- External-consumer lifecycle tests exercise task initialization through user
  acceptance and Delivery.
- Adapter installation tests ensure the installed integration contains the new
  lifecycle and remains bounded.
- Canonical `check`, `typecheck`, and `test` Evidence are refreshed after all
  governed files stabilize.
- The external delivery fixture intentionally omits `test:browser` and proves the
  finalizer skips browser verification while still reaching Builder-ready.

## Risks and Mitigations

- **Legacy task breakage:** planning verification is activated only by the new
  state contract; Review v1.0 records remain readable for historical tasks.
- **Ambiguous findings:** deterministic category/severity/verdict consistency
  rules prevent suggestions from masquerading as blockers.
- **Implicit repair:** task status has an explicit waiting state and the Adapter
  forbids creating a repair decision without the user's instruction.
- **Stale approval:** decision artifacts bind both review content and repository
  snapshot.
- **Hidden subprocess failures:** finalizer captures only bounded diagnostics but
  preserves per-step status and fails at the first untrusted transition.
- **Unproven Token claim:** report the structural reduction separately; require a
  fresh paired replay before making an empirical ratio claim.
