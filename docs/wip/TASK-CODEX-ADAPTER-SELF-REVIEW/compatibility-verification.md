# Compatibility Boundaries

- Embedded repository-owned Adapter versus attached external-consumer Adapter.
- Existing `self-review.ts <TASK_ID>` callers versus explicit `--verify` callers.
- Canonical Evidence freshness versus later semantic review outputs.
- Independent Review freshness after Builder review.

# Preserved Behavior

- No-mode self-review remains a verification operation.
- L0 tasks still do not require Builder self-review.
- L2/L3 still stop at the independent-review boundary.
- Consumer source/task state remains consumer-owned and Runtime contracts remain Engine-owned.

# Risks

- Existing tasks with only legacy inline self-review fields must prepare and create the new snapshot-bound artifact before Delivery.
- Review packet refresh must be idempotent after the initial phase transition so it cannot stale browser proof or Evidence.

# Evidence

Canonical typecheck and test Evidence are required, plus the complete external L2 delivery regression.

The real `agent/issue-management` consumer additionally passed task identity, Context readiness, Context Scope, Context, verification-plan and Skill-output checks under the external Runtime. Its delivery intentionally remains blocked at `browser-interaction`: a diagnostic Codex browser session passed, but the consumer has neither a snapshot-bound `test:browser` proof nor a human coverage record.
