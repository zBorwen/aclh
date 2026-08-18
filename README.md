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
│   ├── plugins/
│   │   ├── rules/             # 规范插件（naming / react / typescript-strict）
│   │   ├── process/           # 流程插件（full-lifecycle / tdd-workflow / pr-review / testing-only）
│   │   └── templates/         # 模板插件（spec / task-tdd / bug-entry）
│   ├── project/               # 项目知识资产（profile / architecture / bug-ledger / gotchas / decisions / dev-notes）
│   ├── scripts/               # check.ts / init-task.ts / self-review.ts（TS，Node≥22 原生运行）
│   └── hooks/                 # pre-commit.sh / pre-push.sh（Git 钩子，需手动安装）
├── docs/wip/                  # 任务工作区（按任务 ID 隔离）
└── diagrams/                  # 5 张 Excalidraw 架构图
```

## 当前 Agent 适配范围

- **Supported:** OpenAI Codex（通过 `AGENTS.md` + `.harness/`）
- **Not supported for now:** Cursor、GitHub Copilot、Claude Code 等专用入口
- 当前阶段优先把 Codex 的治理、门禁和证据链跑通；其他 Agent 适配等核心模型稳定后再评估。

## 核心机制（30 秒版）

- **双环验证**：内环（TDD：RED → GREEN → REFACTOR + 机器门禁）由 AI 自闭环；外环（人工审查）由人把关，拒绝必须"先转测试再修复"。
- **对抗式自检**：任务完成后、提交人工审查前，必须运行 `self-review.ts` 主动质问自己"遗漏了什么 / 忽略了什么"，缺口清零才能提交。
- **知识飞轮**：人工审查拒绝→修复→自动沉淀进 bug-ledger → 后续任务编码前强制读取 → 不再犯同类错误。
- **预设装配**：`harness.yaml` 按任务类型选择 preset（full-lifecycle / testing-only / maintenance / quick-start），决定当前激活哪些规则、流程、模板。

## 快速开始（本地）

```bash
# 环境要求：Node.js >= 22（原生运行 .ts，无需 tsx/ts-node）
npm install                        # 安装 dev 依赖（typescript / @types/node / yaml）
npm run typecheck                  # tsc --noEmit 类型检查

node .harness/scripts/check.ts     # 静态规则检查（解析 harness.yaml 执行激活插件 checks）
node .harness/scripts/init-task.ts JIRA-101   # 初始化任务工作区 docs/wip/JIRA-101/
node .harness/scripts/self-review.ts JIRA-101 # 任务完成后的对抗式自检
```

## 设计决策与注意事项（开发记录）

1. **配置模板初始为空**：`project/*.yaml` 是模板形态（profile/architecture 等未填），因为模板无法预知真实项目形态。**接入真实项目时必须先做初始化**：分析项目后填入 profile/architecture/命令，再让双环门禁真正生效。
2. **AGENTS.md 分三层**：回归治理层（流程轨道：阅读顺序 / 预设 / 双环）＋ 行为层（认知模型：先读后写、现象→结构→原则、最小变更、输出结构）＋ 边界层（约束方式不约束创造力，用户指令优先于流程）。行为层第一条原则：**DO NOT send optional commentary**（不要客套话和废话）。
3. **第一性原理优先**：修 bug / 做需求时禁止默认沿现有实现打补丁。必须先剥离现有代码与惯例，拆解问题本质，**根治优先**；仅当问题复杂、无法一次根治时允许分步修复，且必须把根治方向记录为跟踪的终态（不得把补丁当终点）。
4. **对抗式自检机制**：文档门禁（AGENTS.md A4）→ 可执行脚本（`self-review.ts`：校验产物完整性 + 状态机合法性 + 10 条敌对方质问）→ 自动触发（`pre-push.sh`，有 active 任务时强制运行，MISS 即阻断 push）→ 状态记录（`.state.yaml` 的 `self_review` 段）。三者形成闭环。
5. **hooks 当前未安装**：`.harness/hooks/` 的 pre-commit / pre-push 需要手动复制到 `.git/hooks/` 才生效。**本项目目前仅本地开发**，有意不安装；接入真实项目时改为 husky / lefthook / CI 管道统一接入。
6. **scripts 全部使用 TypeScript**：Node ≥ 22 原生 type-stripping 可直接 `node xxx.ts` 运行，无运行时依赖。`tsconfig.json` 开启 `erasableSyntaxOnly`——**禁止 enum / namespace / 构造参数属性**等不可擦除语法（与原生运行方式强绑定）。`yaml` 等仅工具链使用的依赖放在 `devDependencies`。
7. **package-lock.json 不纳入版本库**（`.gitignore` 排除），按仓库维护者偏好保持精简。
8. **图表为静态产物**：`diagrams/` 下 5 张 Excalidraw 图由生成器脚本产出，生成器已删除；后续改图需直接编辑 JSON 或重建生成器脚本。
9. **双环铁律**：禁止跳过 RED；禁止为通过测试而篡改测试；重构后测试数量不得减少；外环拒绝后禁止不写测试直接改实现。
10. **当前只适配 Codex**：不维护 Cursor、Copilot、Claude Code 等专用入口文件，避免多 Agent 适配在核心治理模型未稳定前增加额外兼容成本。

## 接入真实项目指南（推荐顺序）

1. **初始化上下文**：clone 后先分析项目，填充 `project/profile.yaml`（技术栈、命令）与 `project/architecture.yaml`（模块边界、依赖方向）；在 `.harness/harness.yaml` 选择匹配的 preset。
2. **接入自动化门禁**：将 `check.ts` / `self-review.ts` 接入 CI 或 husky/lefthook（pre-commit 跑 check + lint + test；推送前跑 self-review）。
3. **跑通第一个真实任务**：`init-task.ts` 建任务 → 按 AGENTS.md 走双环 → 提交前跑自我 review → 人工审查 → 交付。
4. **开始沉淀知识**：第一个真实 Bug / 教训写入 `bug-ledger.yaml` / `gotchas.yaml`，知识飞轮从此转起来。

## 当前状态（截至 2026-08）

- Agent 适配：Codex only
- `npm run typecheck`：通过（strict + erasableSyntaxOnly）
- `node .harness/scripts/check.ts`：PASS（0 failed）
- 5 张 Excalidraw 图：JSON 校验通过
- Git hooks：未安装（本地开发阶段）
- `lint` 命令：未配置（等接入真实项目后填入 profile.yaml）