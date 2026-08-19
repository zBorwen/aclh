# AI Coding Lifecycle Harness (ACLH)

一套把 AI 编码过程约束在 **Rules + Process + Memory + Guardrails** 四条轨道上的工程治理 Harness。当前只适配 **OpenAI Codex**，以 `AGENTS.md` 作为唯一 Agent contract。

> P1 Evidence/Review trust 见 `.harness/EVIDENCE.md`；P2 风险与上下文治理见 `.harness/P2_GOVERNANCE.md`；P3 Engineering Skill contract 见 `.harness/SKILLS.md`。

## 当前核心能力

- **P0 Enforcement**：区分 advisory / verifiable / blocking，保留最小确定性 blocking 编码规则。
- **P1 Trust Layer**：local evidence freshness、CI provenance、Builder self-review、Independent Review。
- **P2 Governance Scaling**：Risk-based lifecycle、task-specific verification strategy、Task identity、Dynamic Context、Top-K Knowledge Retrieval。
- **P3 Engineering Skills（开发中）**：Task Classification、Skill Contract、Skill Plan、Skill-aware Context；Workflow 将逐步成为 Skill composition 的解析结果。

## P2 快速开始

```bash
# 默认 L2 + tdd
node .harness/scripts/init-task.ts JIRA-101

# 也可以显式声明风险与验证方式
node .harness/scripts/init-task.ts JIRA-102 --risk L1 --strategy component

# L1+：生成任务相关上下文，不再全量读取 project knowledge
node .harness/scripts/context-select.ts JIRA-102 --generate

# 完成 test-plan.md 中当前 strategy 对应的 markers
node .harness/scripts/verification-plan.ts JIRA-102

# 可选：任务已有 PR 时显式绑定
node .harness/scripts/task-identity.ts JIRA-102 --bind-pr 123

# 按 risk 记录需要的 machine evidence
npm run evidence -- JIRA-102 --gate check
npm run evidence -- JIRA-102 --gate typecheck
npm run evidence -- JIRA-102 --gate test

# 单一交付入口：自动按 risk 执行所需 gates/reviews
node .harness/scripts/delivery-gate.ts JIRA-102
```

## Risk-based lifecycle

| Risk | Intended use | Required delivery depth |
|---|---|---|
| `L0` | trivial/mechanical | check only |
| `L1` | low-risk local change | fresh context + check/typecheck/test + Builder self-review |
| `L2` | normal/default | L1 + fresh-context Codex or human independent review |
| `L3` | high-risk/cross-boundary | L2 + human independent review only |

风险等级只增加约束，不应为了绕过 gate 而降级。

## Verification strategy

TDD 不再是所有任务的绝对流程。任务在 `.state.yaml` 中声明：

- `tdd` → RED / GREEN / REFACTOR
- `component` → COMPONENT_TEST / INTERACTION_CHECK
- `config` → SCHEMA_VALIDATION / SMOKE_TEST
- `migration` → COMPATIBILITY_CHECK / ROLLBACK_CHECK
- `docs` → DOC_STRUCTURE / LINK_OR_EXAMPLE_CHECK

`verification-plan.ts` 会在交付时检查对应 marker 已完成。P3 在验证 Skill 模型稳定之前保留这个字段作为 P2 compatibility layer，不提前废弃。

## Dynamic Context + Knowledge Retrieval

P2 的 `context-select.ts` 基于 task base commit 的 changed files、显式 `context_scope`、architecture module/path 和一跳依赖生成 `context.json`。L1+ 交付时必须验证它仍然 fresh。

bug-ledger / gotchas / ADR 不再全量注入。P2 按 module、file、tag/category、severity 做确定性相关度评分，并按 `governance.yaml` 的 `max_items_per_source` 做 Top-K 截断。P3 将保留这些 bounded/freshness 机制，只改变 Context requirement 的来源：由 Skill Contract 声明需求，再由通用 Context Runtime 解析。

## Task identity

任务初始化时绑定：

```yaml
identity:
  branch: feature/example
  base_commit: <40-char-sha>
  pr_number: null
```

交付时必须仍处于绑定分支，`base_commit` 必须是当前 HEAD 的祖先；绑定 PR 后，在 GitHub Actions PR 环境中还会核对 PR number。

## P3 Engineering Skills 边界

P3 v1 只把 `understanding` 与 `verification` 能力建模为 Skill。Risk、Evidence、CI provenance、Reviewer、Delivery Gate、Context Resolver 都属于 Runtime，而不是 Skill。

第一版 Skill selection 保持显式，不提前决定“AI 推荐”还是“规则固定映射”。先验证 Classification、Skill Contract、dependency resolution、Skill Plan 与 Skill-aware Context 是否成立，再用真实运行结果决定后续自动选择策略。

## Trust boundary

- Local Evidence 是 repository-local 证据，不是防篡改 attestation。
- CI Evidence 由 GitHub Actions 独立执行并带 run provenance。
- Builder self-review 不等于 Independent Review。
- Fresh-context Codex isolation 目前是协议级声明，不是密码学证明。
- Skill 自身不能制造可信 PASS；P3 必须复用 P1 Evidence/Review 链。
- Semgrep、AST/dependency enforcement、vector retrieval、Dashboard 不属于当前 P3 基线。

## 当前状态（2026-08）

- Agent：Codex only
- P0：完成
- P1：完成
- P2 Governance Scaling：完成
- P3 Engineering Skills：开发中
- Semgrep：未接入
- 旧静态 Excalidraw 架构图：已从 P3 分支删除，后续以可执行契约与运行时行为为准
