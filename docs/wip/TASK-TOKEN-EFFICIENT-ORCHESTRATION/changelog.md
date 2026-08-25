# Changelog

- 2026-08-25: Initialized task TASK-TOKEN-EFFICIENT-ORCHESTRATION (risk L2, strategy tdd, branch agent/token-efficient-orchestration)
- 2026-08-25: Added compact Runtime task status and review-readiness preflight backed by existing canonical verifiers.
- 2026-08-25: Made Builder/Reviewer write boundaries explicit and removed duplicated task document bodies from review packets.
- 2026-08-25: Reduced Codex Adapter lifecycle text and directed continuations through bounded machine status.
- 2026-08-25: Split experiment reporting into observed, valid workflow, orchestration waste and aborted/setup totals with compatibility for old records.
- 2026-08-25: Canonical check/typecheck and the expanded 104-test repository suite pass; experiment controller suite passes 5/5.
- 2026-08-25: Applied the compact contract/status flow to the actual external Codex integration used by consumer experiments, reducing its installed Adapter text from 15.6KB to 7.9KB.
