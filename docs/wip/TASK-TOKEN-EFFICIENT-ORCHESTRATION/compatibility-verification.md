# Compatibility Boundaries

- Embedded and external Runtime root resolution.
- Existing init, Context, Evidence, self-review, independent-review and delivery
  command entry points.
- Independent-review snapshot semantics and legacy v1.0 record compatibility.
- Existing experiment result files without `category`.
- Existing explicit `browser-verification.ts` entry point and browser-proof schema.

# Preserved Behavior

- Builder self-review remains callable but is no longer a default gate.
- L1/L2 require separate Codex/human Review; L3 still requires a human.
- Legacy tasks without a planning declaration bypass the new planning verifier.
- L3 continues to require a human reviewer.
- Source/task changes stale review; semantic review outputs do not stale Evidence.
- Consumer repositories contain task state but no copied Runtime implementation.
- Legacy result records remain reportable through status/run inference.
- Browser tests remain supported when explicitly selected; only the unconditional
  Adapter invocation is removed.
- Active accept decisions retain their existing `review-decision.json` contract;
  only Repair rounds are rotated.

# Risks

- Incorrect skip semantics could report downstream failures before prerequisites.
- Extracting snapshot logic could change hashes and invalidate valid review records.
- Planning structure checks cannot prove prose quality; independent Review remains
  responsible for semantic adequacy.
- A decision artifact could become stale if its review or repository binding is
  incomplete.
- Reporting categories could hide waste if observed totals did not remain inclusive.

# Evidence

External lifecycle and review tests preserve snapshot and policy behavior. Adapter
attachment tests validate the published capability. Controller tests validate both
new and legacy result categorization.
