# Changelog

- 2026-08-25: Initialized task TASK-TOKEN-EFFICIENT-ORCHESTRATION (risk L2, strategy tdd, branch agent/token-efficient-orchestration)
- 2026-08-25: Added compact Runtime task status and review-readiness preflight backed by existing canonical verifiers.
- 2026-08-25: Made Builder/Reviewer write boundaries explicit and removed duplicated task document bodies from review packets.
- 2026-08-25: Reduced Codex Adapter lifecycle text and directed continuations through bounded machine status.
- 2026-08-25: Split experiment reporting into observed, valid workflow, orchestration waste and aborted/setup totals with compatibility for old records.
- 2026-08-25: Canonical check/typecheck and the expanded 104-test repository suite pass; experiment controller suite passes 5/5.
- 2026-08-25: Applied the compact contract/status flow to the actual external Codex integration used by consumer experiments, reducing its installed Adapter text from 15.6KB to 7.9KB.
- 2026-08-25: Added authored `spec.md -> plan.md -> tasks.md` planning templates and a deterministic pre-implementation verifier.
- 2026-08-25: Replaced default Builder self-review with read-only independent Review for L1-L3 and added typed Review v1.1 dispositions/findings.
- 2026-08-25: Added snapshot-bound explicit user accept/Repair decisions; task status now stops after Review instead of automatically selecting Repair.
- 2026-08-25: Removed both Pocket Ledger replay project directories from the active experiment workspace and moved them to the macOS Trash for recovery.
- 2026-08-26: Published exact bootstrap artifact shapes so normal Adapter execution no longer needs Runtime README/source discovery.
- 2026-08-26: Added bounded Builder finalization and made browser verification explicit opt-in through Verification Gaps.
- 2026-08-26: Rotated authorized Repair rounds to remove the stale active-Review dead end.
- 2026-08-26: Deleted the unreferenced historical TASK-CODEX-ADAPTER-SELF-REVIEW task package.
- 2026-08-26: Full repository regression suite passes 106/106 after the bootstrap, browser, finalizer, and Repair-cycle changes.
