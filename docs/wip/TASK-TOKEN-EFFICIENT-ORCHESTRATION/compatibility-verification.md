# Compatibility Boundaries

- Embedded and external Runtime root resolution.
- Existing init, Context, Evidence, self-review, independent-review and delivery
  command entry points.
- Independent-review snapshot semantics and record schema.
- Existing experiment result files without `category`.

# Preserved Behavior

- L2 requires Builder self-review plus separate Codex/human review.
- L3 continues to require a human reviewer.
- Source/task changes stale review; semantic review outputs do not stale Evidence.
- Consumer repositories contain task state but no copied Runtime implementation.
- Legacy result records remain reportable through status/run inference.

# Risks

- Incorrect skip semantics could report downstream failures before prerequisites.
- Extracting snapshot logic could change hashes and invalidate valid review records.
- Compact packets could omit required reviewer context if source paths are absent.
- Reporting categories could hide waste if observed totals did not remain inclusive.

# Evidence

External lifecycle and review tests preserve snapshot and policy behavior. Adapter
attachment tests validate the published capability. Controller tests validate both
new and legacy result categorization.
