# AI Coding Lifecycle Harness (ACLH)

一套把 AI 编码过程约束在 **规则 (Rules) + 流程 (Process) + 记忆 (Memory) + 门禁 (Guardrails)** 四条轨道上的工程治理模板。当前阶段只适配 **OpenAI Codex**，通过仓库根目录的 `AGENTS.md` 作为统一入口，在真实项目中约束 Codex 稳定地产出可审查、可复用、低返工的代码。

> 设计全景见 [`HARNESS_ANALYSIS.md`](HARNESS_ANALYSIS.md)；Codex 行为约束见 [`AGENTS.md`](AGENTS.md)（最高优先级）。

---

## 目录结构

```
.
├── AGENTS.md                  # Codex 最高约束：治理层 + 行为层（全英文）
├── HARNESS_ANALYSIS.md        # 架构深度分析文档（中文）
├── .harness/
│   ├── harness.yaml           # 配置中心：preset 预设 / 插件装配
│   ├── ENFORCEMENT.md         # advisory / verifiable / blocking 强制等级契约
│   ├── EVIDENCE.md            # P1 机器执行证据模型
│   ├── plugins/
│   │   ├── rules/             # 规范插件（naming / react / typescript-strict）
│   │   ├── process/           # 流程插件（full-lifecycle / tdd-workflow / pr-review / testing-only）
│   │   └── templates/         # 模板插件（spec / task-tdd / bug-entry）
│   ├── project/               # 项目知识资产（profile / architecture / bug-ledger / gotchas / decisions / dev-notes）
│   ├── scripts/               # check.ts / init-task.ts / evidence.ts / self-review.ts
│   └── hooks/                 # pre-commit.sh / pre-push.sh（Git 钩子，需手动安装）
├── docs/wip/                  # 任务工作区（按任务 ID 隔离，含 evidence.json）
└── diagrams/                  # 静态架构图，阶段稳定后统一更新
```

## 当前 Agent 适配范围

- **Supported:** OpenAI Codex（通过 `AGENTS.md` + `.harness/`）
- **Not supported for now:** Cursor、GitHub Copilot、Claude Code 等专用入口
- 当前阶段优先把 Codex 的治理、门禁和证据链跑通；其他 Agent 适配等核心模型稳定后再评估。

## 核心机制（30 秒版）

- **双环验证**：内环（TDD：RED → GREEN → REFACTOR + 机器门禁）由 AI 自闭环；外环（人工审查）由人把关，拒绝必须"先转测试再修复"。
- **对抗式自检**：任务完成后、提交人工审查前，必须运行 `self-review.ts` 主动质问自己"遗漏了什么 / 忽略了什么"，缺口清零才能提交。
- **机器证据**：`evidence.ts` 真实执行 `check / typecheck / test`，并把 PASS 绑定到当前 `HEAD SHA + worktree SHA-256`；代码一旦变化，旧证据立即失效。
- **知识飞轮**：人工审查拒绝→修复→自动沉淀进 bug-ledger → 后续任务编码前强制读取 → 不再犯同类错误。
- **预设装配**：`harness.yaml` 按任务类型选择 preset（full-lifecycle / testing-only / maintenance / quick-start），决定当前激活哪些规则、流程、模板。

## 快速开始（本地）

```bash
# 环境要求：Node.js >= 22（原生运行 .ts，无需 tsx/ts-node）
npm install
npm run typecheck

node .harness/scripts/check.ts
node .harness/scripts/init-task.ts JIRA-101

# P1 Evidence Model v1.1：执行真实 gate 并绑定当前仓库快照
npm run evidence -- JIRA-101 --gate check
npm run evidence -- JIRA-101 --gate typecheck
npm run evidence -- JIRA-101 --gate test
npm run evidence -- JIRA-101 --verify

node .harness/scripts/self-review.ts JIRA-101
```

## 设计决策与注意事项（开发记录）

1. **配置模板初始为空**：`project/*.yaml` 是模板形态（profile/architecture 等未填），因为模板无法预知真实项目形态。接入真实项目时必须先填充 profile / architecture / commands。
2. **AGENTS.md 分三层**：治理层（流程轨道）＋行为层（先读后写、第一性原理、最小变更）＋边界层（约束方式不约束创造力）。
3. **第一性原理优先**：修 bug / 做需求时禁止默认沿现有实现打补丁；根治优先，无法一次根治时必须记录终态方向。
4. **任务提交双门禁**：`evidence.ts --verify` → `self-review.ts` → 人工审查。机器证据先证明客观 gate，再进行对抗式 reasoning review。
5. **Evidence v1.1 新鲜度**：每条证据绑定 commit SHA 和工作区内容指纹。任何后续 commit、staged/unstaged 修改或未跟踪文件内容变化都会使证据 stale。`evidence.json` 自身不参与指纹，避免自我失效。
6. **Evidence 信任边界**：当前仍是仓库本地记录，不是防篡改 attestation；后续再增加 CI provenance、verifier identity、输出摘要或签名证据。
7. **Semgrep 尚未接入**：当前静态规则引擎仍是 ACLH 自有的 filename/grep 等轻量检查；Semgrep 留到后续 Check Engine 增强阶段。
8. **hooks 当前未安装**：`.harness/hooks/` 的 pre-commit / pre-push 需要手动安装；真实项目建议接 CI required check 或统一 hook manager。
9. **scripts 全部使用 TypeScript**：Node ≥ 22 原生 type-stripping 直接执行，`tsconfig.json` 开启 `erasableSyntaxOnly`。
10. **静态架构图延后更新**：等 P1/P2 核心模型阶段性稳定后统一刷新，避免每个小阶段反复维护静态图。
11. **当前只适配 Codex**：暂不维护 Cursor、Copilot、Claude Code 等专用入口。

## 接入真实项目指南（推荐顺序）

1. 初始化上下文：填充 `project/profile.yaml` 与 `project/architecture.yaml`，选择匹配 preset。
2. 初始化任务：`init-task.ts` 创建 WIP 目录和 Evidence v1.1 文件。
3. 开发与验证：完成实现后使用 `evidence.ts` 真实执行 `check / typecheck / test`。
4. 若代码发生任何修改，重新执行三项 gate；旧证据不能复用。
5. 提交前验证：`evidence.ts --verify` → `self-review.ts` → 人工审查。
6. 将真实 Bug / Review 教训写入 `bug-ledger.yaml` / `gotchas.yaml`。

## 当前状态（截至 2026-08）

- Agent 适配：Codex only
- P0 enforcement：最小 direct-blocking 规则已冻结
- P1 Evidence Model：v1.1 已绑定 commit + worktree fingerprint
- P1 workflow blocking：check / typecheck / test 需要 fresh PASS evidence
- Semgrep：尚未接入
- Git hooks：未安装（本地开发阶段）
- 静态架构图：待核心模型阶段性稳定后统一更新
