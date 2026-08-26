# ACLH Current Architecture Diagrams

当前 P0–P3 架构使用 5 张可编辑 Excalidraw 图拆开展示，避免单图信息密度过高。

1. [`01-system-overview.excalidraw`](./01-system-overview.excalidraw) — 全局分层：P0 Enforcement、P1 Trust、P2 Governance、P3 Engineering Skills。
2. [`02-task-to-delivery.excalidraw`](./02-task-to-delivery.excalidraw) — 单个 Task 从 bootstrap 到 Trusted Delivery 的完整执行链。
3. [`03-skill-runtime.excalidraw`](./03-skill-runtime.excalidraw) — P3 内部：Classification、Skill Plan、Dependency Resolver、Context/Output/Evidence contracts。
4. [`04-governance-trust.excalidraw`](./04-governance-trust.excalidraw) — Risk、machine verifier、Evidence freshness、CI provenance、Independent Review 与用户决策；图中旧 self-review 门禁以当前 executable contracts 为准。
5. [`05-repository-structure.excalidraw`](./05-repository-structure.excalidraw) — 当前仓库 Contracts、Runtime、Project Knowledge、Task Workspace 的职责映射。

## 推荐阅读顺序

`01 → 02 → 03 → 04 → 05`

- 只想快速理解 ACLH：看 01。
- 想知道一个任务实际怎么走：看 02。
- 想理解为什么 Workflow 现在由 Skill composition 形成：看 03。
- 想理解 ACLH 的证据链和分层验证：看 04。
- 想开始改 Runtime / Skill / Context：看 05。

## Source of truth

这些图是解释性文档，不覆盖可执行契约。若图与仓库行为冲突，优先级为：

1. `AGENTS.md`
2. `.harness/SKILLS.md`
3. `.harness/P2_GOVERNANCE.md`
4. `.harness/EVIDENCE.md`
5. executable Harness behavior / regression tests

架构图应随着真实 Contract / Runtime 变化同步更新，而不是反过来驱动 Runtime。
