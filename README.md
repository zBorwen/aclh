# AI Coding Lifecycle Harness (ACLH)

一套把 AI 编码过程约束在 **Rules + Process + Memory + Guardrails** 四条轨道上的工程治理 Harness。当前只适配 **OpenAI Codex**，以 `AGENTS.md` 作为唯一 Agent contract。

> P1 Evidence/Review trust 见 `.harness/EVIDENCE.md`；P2 风险与上下文治理见 `.harness/P2_GOVERNANCE.md`；P3 Engineering Skills 见 `.harness/SKILLS.md`。

## 当前核心能力

- **P0 Enforcement**：advisory / verifiable / blocking + 最小确定性 blocking 规则。
- **P1 Trust Layer**：repository-bound Evidence、CI provenance、只读 Independent Review、显式用户决策。
- **P2 Governance Scaling**：Risk、Task identity、task-dependent verification、bounded Context/Knowledge retrieval。
- **P3 Engineering Skills**：Classification、Skill Contract、dependency resolution、Explicit Skill Plan、Skill-aware Context、Skill Output、Skill→Evidence、统一 Delivery Gate。

## 当前架构图

可编辑 Excalidraw 图集位于 [`docs/architecture/`](./docs/architecture/README.md)：

1. `01-system-overview.excalidraw` — P0–P3 全局分层与边界。
2. `02-task-to-delivery.excalidraw` — Task 到 Trusted Delivery 的完整执行链。
3. `03-skill-runtime.excalidraw` — Skill Contract / Plan / Context / Output / Evidence Runtime。
4. `04-governance-trust.excalidraw` — Risk、Verifier、Evidence、CI、Self-review、Independent Review。
5. `05-repository-structure.excalidraw` — 当前仓库目录与职责映射。

这些图是解释性文档；若与代码冲突，以 `AGENTS.md`、`.harness/*` executable contracts 与 regression tests 为准。

## P3 核心模型

```text
Task
  -> Classification
  -> Explicit Skill Plan
  -> Dependency-resolved Skills
  -> Skill-aware Context
  -> Spec -> Plan -> Tasks
  -> Builder
  -> Skill Outputs
  -> Risk Evidence + Skill Evidence
  -> Review
```

Workflow 不再作为主要复用单元；它是 Skill Plan 解析后的任务实例。

P3 v1 的 Skill selection 保持显式。Classification 只描述任务，不自动选择 Skill；“AI 推荐 Skill”还是“规则固定映射”留到真实使用积累后再决定。

## P3 v1 Skill catalog

Understanding Skills：
- `task-decomposition`
- `root-cause-analysis`
- `change-impact-analysis`

Verification Skills：
- `regression-verification`
- `compatibility-verification`

Execution Skills 暂不进入 P3 v1，真正实现仍由 Builder 负责。

## P3 task workflow

先运行 `task-contract.ts --json` 获取 Classification、Skill Plan、Verification
Gaps 与 Skill outputs 的完整可写格式；正常编排不需要再阅读 Runtime README、
测试或源码来猜格式。

```bash
# 1. 初始化 task（P2 risk/identity 仍保留）
node .harness/scripts/init-task.ts TASK-123 --risk L2 --strategy tdd

# 2. 编写 docs/wip/TASK-123/classification.yaml，然后验证
node .harness/scripts/classification.ts TASK-123 --verify

# 3. 显式编写 skill-plan.yaml，再做确定性 dependency resolution
node .harness/scripts/skill-plan.ts TASK-123 --resolve
node .harness/scripts/skill-plan.ts TASK-123 --verify

# 4. Skill Contract 决定 Context requirements
node .harness/scripts/context-select.ts TASK-123 --generate

# 5. 完成详细 spec.md、plan.md、tasks.md，再验证规划边界
node .harness/scripts/task-planning.ts TASK-123 --verify

# 6. 实现与 Skill outputs 稳定后，一次完成 Context/Evidence/Builder 收尾
node .harness/scripts/builder-finalize.ts TASK-123 --json

# 9. 独立 Review 后先报告给用户；用户接受后再交付
node .harness/scripts/independent-review.ts TASK-123 --prepare
node .harness/scripts/independent-review.ts TASK-123 --verify
node .harness/scripts/review-decision.ts TASK-123 --accept
node .harness/scripts/delivery-gate.ts TASK-123
```

浏览器验证不是默认后置步骤。只有 `verification-gaps.yaml` 因需求或验收标准
显式声明 `machine_proofs: [browser]` 时，Builder finalizer 才会运行它；普通小
任务不需要 `test:browser`。

## Classification

Classification v1 的 primary 只允许：

```text
feature | bug | refactor | migration | integration
```

Traits 用来表达 `cross-module`、`dependency-change`、`compatibility-sensitive` 等正交属性。Confidence 只使用 `high / medium / low`，避免伪精确概率。

Classification 是 task description artifact，不是 Skill recommendation artifact。

## Skill Contract

Skill Contract 位于 `.harness/skills/*.yaml`，声明：
- identity / kind
- required + optional Context capabilities
- Skill dependencies
- produced artifacts / facts
- completion invariants

Skill Contract 不能声明 risk、reviewer、CI provenance 或自有可信 PASS。

`.harness/context/capabilities.yaml` 是 Context vocabulary；Skill 请求 Runtime 不支持的 Context 会直接成为配置错误。

## Skill-aware Context

P3 `context.json` v2 根据**resolved Skill Contracts**收集 Context requirements，同一个 Context capability 只解析一次，同时记录 `required_by / optional_by` provenance。

Freshness 绑定：
- repository change content SHA-256；
- explicit scope；
- Skill Plan；
- Skill Context contract / capability definition；
- retrieval policy。

因此即使 changed-file 名称没变，只要内容、Skill Plan 或 Skill Context Contract 变化，旧 Context 也会 stale。

旧 P2 task 没有 `skill-plan.yaml` 时继续走 `context.json` v1.1 compatibility path。

## Skill Output + Evidence

`.harness/artifacts/skill-outputs.yaml` 定义 Skill artifact 的最低机器结构：文件存在、非空、关键 section 完整。自然语言 completion invariants 仍属于语义 Review，不用结构检查冒充语义正确。

Verification Skill 不拥有第二套 PASS：`.harness/policies/skill-evidence.yaml` 只把它们映射到 P1 已存在的 canonical gates。

例如：

```text
regression-verification
        -> test

compatibility-verification
        -> typecheck + test
```

因此 L0 风险虽然本身只要求 `check`，如果任务显式选择了 `regression-verification`，仍必须提供 fresh `test` Evidence。

## Risk + P2 compatibility

| Risk | Risk-level delivery depth |
|---|---|
| `L0` | `check` Evidence；无强制 self/independent review |
| `L1` | check/typecheck/test + fresh-context Codex 或 human Independent Review |
| `L2` | check/typecheck/test + fresh-context Codex 或 human Independent Review |
| `L3` | check/typecheck/test + human-only Independent Review |

P3 Skill requirements 与 Risk 正交：Skill 决定需要什么工程能力，Risk 决定治理深度。

P2 `verification_strategy` 在 P3 v1 **暂不废弃**。当前五个 Skill 尚未完整覆盖 component/config/docs/rollback markers，过早删除会丢失已经验证过的能力，因此先作为 compatibility layer 保留。

## Trust boundary

- Local Evidence 是 repository-local evidence，不是防篡改 attestation。
- CI Evidence 由 GitHub Actions 独立重跑 canonical gates 并记录 provenance。
- Builder self-review 是可选清单，不是默认交付门禁，也不等于 Independent Review。
- Independent Review 只报告 findings；Repair 必须由用户明确选择。
- Fresh-context Codex isolation 目前是协议级声明，不是密码学证明。
- Skill output 不等于 Verification PASS；Verification Skill 必须依赖 fresh P1 machine Evidence。
- AI 自动 Skill recommendation / Classification→Skill fixed mapping 都不属于 P3 v1。
- Semgrep、AST dependency enforcement、vector retrieval、Dashboard 不属于当前 P3。

## 当前状态（2026-08）

- Agent：Codex only
- P0：完成
- P1：完成
- P2：完成
- P3 Engineering Skills v1：**完成**
- P2 `verification_strategy`：保留为 compatibility layer
- Semgrep：未接入
- 当前静态架构图：`docs/architecture/` 下 5 张可编辑 Excalidraw，旧图已替换
