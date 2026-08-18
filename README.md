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
│   ├── EVIDENCE.md            # P1 机器执行证据模型 v1
│   ├── plugins/
│   │   ├── rules/             # 规范插件（naming / react / typescript-strict）
│   │   ├── process/           # 流程插件（full-lifecycle / tdd-workflow / pr-review / testing-only）
│   │   └── templates/         # 模板插件（spec / task-tdd / bug-entry）
│   ├── project/               # 项目知识资产（profile / architecture / bug-ledger / gotchas / decisions / dev-notes）
│   ├── scripts/               # check.ts / init-task.ts / evidence.ts / self-review.ts
│   └── hooks/                 # pre-commit.sh / pre-push.sh（Git 钩子，需手动安装）
├── docs/wip/                  # 任务工作区（按任务 ID 隔离，含 evidence.json）
└── diagrams/                  # 5 张 Excalidraw 架构图
```

## 当前 Agent 适配范围

- **Supported:** OpenAI Codex（通过 `AGENTS.md` + `.harness/`）
- **Not supported for now:** Cursor、GitHub Copilot、Claude Code 等专用入口
- 当前阶段优先把 Codex 的治理、门禁和证据链跑通；其他 Agent 适配等核心模型稳定后再评估。

## 核心机制（30 秒版）

- **双环验证**：内环（TDD：RED → GREEN → REFACTOR + 机器门禁）由 AI 自闭环；外环（人工审查）由人把关，拒绝必须"先转测试再修复"。
- **对抗式自检**：任务完成后、提交人工审查前，必须运行 `self-review.ts` 主动质问自己"遗漏了什么 / 忽略了什么"，缺口清零才能提交。
- **机器证据**：`evidence.ts` 执行并记录 `check / typecheck / test` 的命令、时间、退出码和结果；pre-push 在 self-review 前验证三类证据均为 PASS。
- **知识飞轮**：人工审查拒绝→修复→自动沉淀进 bug-ledger → 后续任务编码前强制读取 → 不再犯同类错误。
- **预设装配**：`harness.yaml` 按任务类型选择 preset（full-lifecycle / testing-only / maintenance / quick-start），决定当前激活哪些规则、流程、模板。

## 快速开始（本地）

```bash
# 环境要求：Node.js >= 22（原生运行 .ts，无需 tsx/ts-node）
npm install
npm run typecheck

node .harness/scripts/check.ts
node .harness/scripts/init-task.ts JIRA-101

# P1 Evidence Model v1：执行真实 gate 并写入 docs/wip/JIRA-101/evidence.json
npm run evidence -- JIRA-101 --gate check
npm run evidence -- JIRA-101 --gate typecheck
npm run evidence -- JIRA-101 --gate test
npm run evidence -- JIRA-101 --verify

node .harness/scripts/self-review.ts JIRA-101
```

## 设计决策与注意事项（开发记录）

1. **配置模板初始为空**：`project/*.yaml` 是模板形态（profile/architecture 等未填），因为模板无法预知真实项目形态。**接入真实项目时必须先做初始化**：分析项目后填入 profile/architecture/命令，再让双环门禁真正生效。
2. **AGENTS.md 分三层**：回归治理层（流程轨道：阅读顺序 / 预设 / 双环）＋ 行为层（认知模型：先读后写、现象→结构→原则、最小变更、输出结构）＋ 边界层（约束方式不约束创造力，用户指令优先于流程）。行为层第一条原则：**DO NOT send optional commentary**（不要客套话和废话）。
3. **第一性原理优先**：修 bug / 做需求时禁止默认沿现有实现打补丁。必须先剥离现有代码与惯例，拆解问题本质，**根治优先**；仅当问题复杂、无法一次根治时允许分步修复，且必须把根治方向记录为跟踪的终态（不得把补丁当终点）。
4. **对抗式自检机制**：文档门禁（AGENTS.md A4）→ `evidence.ts --verify` → `self-review.ts` → `pre-push.sh`，形成任务提交前的机器证据 + 对抗式自检双门禁。
5. **Evidence v1 信任边界**：当前 evidence 是仓库本地的执行记录，不是防篡改证明；拥有仓库写权限的人仍可编辑 `evidence.json`。后续版本再绑定 commit SHA / CI run / 输出摘要 / verifier provenance。
6. **hooks 当前未安装**：`.harness/hooks/` 的 pre-commit / pre-push 需要手动复制到 `.git/hooks/` 才生效。接入真实项目时建议改为 husky / lefthook / CI required check。
7. **scripts 全部使用 TypeScript**：Node ≥ 22 原生 type-stripping 可直接 `node xxx.ts` 运行，无运行时依赖。`tsconfig.json` 开启 `erasableSyntaxOnly`。
8. **package-lock.json 不纳入版本库**（`.gitignore` 排除），按仓库维护者偏好保持精简。
9. **图表为静态产物**：`diagrams/` 下 5 张 Excalidraw 图暂不随每个阶段即时更新，等核心模型阶段性稳定后统一刷新。
10. **双环铁律**：禁止跳过 RED；禁止为通过测试而篡改测试；重构后测试数量不得减少；外环拒绝后禁止不写测试直接改实现。
11. **当前只适配 Codex**：不维护 Cursor、Copilot、Claude Code 等专用入口文件，避免多 Agent 适配在核心治理模型未稳定前增加额外兼容成本。

## 接入真实项目指南（推荐顺序）

1. 初始化上下文：填充 `project/profile.yaml` 与 `project/architecture.yaml`，选择匹配 preset。
2. 初始化任务：`init-task.ts` 创建 WIP 目录和空 Evidence v1 文件。
3. 开发与验证：完成实现后使用 `evidence.ts` 真实执行并记录 `check / typecheck / test`。
4. 提交前验证：`evidence.ts --verify` → `self-review.ts` → 人工审查。
5. 开始沉淀知识：将真实 Bug / Review 教训写入 `bug-ledger.yaml` / `gotchas.yaml`。

## 当前状态（截至 2026-08）

- Agent 适配：Codex only
- P0 enforcement：最小 blocking 规则已冻结
- P1 Evidence Model：v1 支持 check / typecheck / test 的本地执行证据
- Git hooks：未安装（本地开发阶段）
- 静态架构图：待核心模型阶段性稳定后统一更新
