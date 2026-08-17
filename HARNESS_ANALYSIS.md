# AI Coding Lifecycle Harness (ACLH) 深度架构分析与设计全景

---

## 1. 架构定位与设计哲学

在 AI 辅助编程（AI-Assisted Coding / AI Pair Programming）日益普及的今天，传统的 Prompt 方式和零散的 Rule 文件往往面临以下致命痛点：
1. **上下文失控与 Token 浪费**：AI 盲目遍历整个仓库，吸入海量无关代码，不仅消耗巨大，而且容易造成注意力分散（Lost in the Middle）。
2. **缺乏架构边界约束**：AI 倾向于快速给出“能跑就行”的代码，经常破坏既定分层架构（例如在 UI 层直接调用底层的基础设施或数据库）。
3. **重复踩坑（无长时记忆）**：同一个框架陷阱（例如 React `useEffect` 未清理定时器、API 响应少了一层包装），AI 在不同任务中会反复犯错。
4. **测试与实现的因果倒置**：AI 常常先写完业务代码再“补充测试”，甚至为了让测试通过去修改测试断言。
5. **缺少确定性防线**：仅依靠自然语言约束，缺乏本地脚本和 Git 钩子的物理拦截。

**AI Coding Lifecycle Harness (ACLH)** 正是为解决上述痛点而设计的 **“规则(Rules) + 流程(Process) + 记忆(Memory) + 门禁(Guardrails)” 确定性控制系统**。它将不可控的 LLM 生成过程约束在严密的软件工程生命周期轨道中。

---

## 2. 系统五大核心层级与组件组织

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. 多智能体接入协议层 (Cursor / Claude Code / Copilot / AGENTS.md)       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. 配置中心与场景预设 (.harness/harness.yaml -> Presets)                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. 三大插件化支柱 (Plugins: rules/ 规范 · process/ 流程 · templates/ 模板) │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. 活知识与项目记忆中枢 (.harness/project/ -> profile/arch/bug-ledger/..)│
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. 运行时任务空间 (docs/wip/) 与自动化质量门禁 (check.mjs / pre-commit)  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 多智能体接入层 (Agent Routing Layer)
- **跨 IDE/Agent 适配**：项目在根目录和各大主流 AI 工具的配置目录中设立了统一入口：
  - `.cursor/rules/main.mdc`（Cursor IDE）
  - `CLAUDE.md`（Claude Code CLI）
  - `.github/copilot-instructions.md`（GitHub Copilot）
  - `AGENTS.md`（通用 AI Agent / Antigravity 核心规则）
- **按需加载协议**：所有入口均收敛并强制 AI 按照严格的 0→5 步时序加载上下文，禁止无序读取。

### 2.2 配置中心与预设编排 (Harness Configuration & Presets)
- 通过 `.harness/harness.yaml` 实现对任务场景的模块化装配：
  - **`full-lifecycle`**：正式业务开发（覆盖需求规格、组件拆解、TDD任务卡、双环实现、验收与交付）。
  - **`testing-only`**：针对遗留系统的测试加固模式（严格禁止篡改业务源码，仅写测试提升覆盖率）。
  - **`maintenance`**：缺陷修复与日常维护（强绑定 `bug-ledger.yaml` 与 PR 审查清单）。
  - **`quick-start`**：新项目冷启动（极简模式，仅包含基础命名规范）。

### 2.3 三大插件体系 (Pluggable Pillars)
1. **规范插件 (`.harness/plugins/rules/`)**：
   - `naming-frontend.yaml`：文件、变量、组件、Hook、BEM 样式命名规范及正则表达式校验。
   - `react-patterns.yaml`：组件推荐模式（Custom Hooks 提取、受控组件）、禁止模式（禁止直接 DOM 操作、禁止派生状态滥用）与推荐目录结构。
   - `typescript-strict.yaml`：Strict 编译配置、类型约束（禁止 `any`、优先 Discriminated Unions、禁止 `@ts-ignore`）。
2. **流程插件 (`.harness/plugins/process/`)**：
   - `full-lifecycle.yaml`：六阶段生命周期状态机，每个阶段具备严格的 `entry`（进入条件）、`constraints`（约束）和 `exit`（准出条件）。
   - `tdd-workflow.yaml`：核心 TDD 内环与人工审查外环规范，严禁跳过 RED 阶段或削弱断言。
   - `pr-review.yaml`：PR 提交前清单与静态 pattern 扫描（如拦截 `console.log` 和无工单号的 `TODO`）。
   - `testing-only.yaml`：轻量级补测试专属流程与覆盖率门槛。
3. **模板插件 (`.harness/plugins/templates/`)**：
   - `spec.md`：需求规格书模板（验收标准 AC、Figma 链接、技术约束、影响面、非功能需求）。
   - `task-tdd.md`：TDD 任务拆解模板（强制先写 RED 测试清单，再写实现方案）。
   - `bug-entry.yaml`：标准缺陷元数据模板（症状、报错特征、根因、防范规则、复盘教训）。

### 2.4 活知识与项目记忆中枢 (`.harness/project/`)
这是解决 AI “缺乏长时记忆与项目感知” 的核心资产库：
- **`profile.yaml`**：技术栈画像、依赖版本、运行命令（dev/test/lint/build/coverage）。
- **`architecture.yaml`**：模块划分、职责边界、单向依赖方向规则（如 `UI -> Domain -> Infrastructure`）、公开 API。
- **`bug-ledger.yaml`**：历史 Bug 知识账本，记录每一个历史缺陷的根因和预防规则，AI 在编写代码前必须检索。
- **`gotchas.yaml`**：框架与环境暗坑库，提供正反代码模式对比（Wrong Pattern vs Correct Pattern）。
- **`decisions.yaml`**：架构决策记录 (ADR)，记录技术选型上下文、权衡理由和否决备选项。
- **`dev-notes.yaml`**：开发备忘录，沉淀环境兼容性问题、工具链配置等临时发现。

### 2.5 运行时空间与自动化质量门禁
- **任务隔离空间 (`docs/wip/<TASK_ID>/`)**：通过 `node .harness/scripts/init-task.mjs <TASK_ID>` 一键初始化独立任务目录，利用 `.state.yaml` 跟踪任务阶段与审查历史。
- **自动化守门引擎 (`.harness/scripts/check.mjs`)**：
  - 自动解析 `harness.yaml` 并执行激活插件中的 `checks`。
  - 支持 `filename-pattern`（文件名正则）、`grep-pattern`（代码反模式扫描）、`file-exists`（关键文件存在性）以及 `eslint-delegate`（ESLint 规则委托）。
- **物理提交拦截器 (`.harness/hooks/pre-commit.sh`)**：
  - Git Pre-commit 钩子，强制串联：`check.mjs` -> `npm run lint` -> `npm test`，任何一步失败则直接中止 Commit。

---

## 3. 核心机制：双环验证模型 (Dual-Loop Engine)

ACLH 的灵魂在于 **内环 (Inner Loop)** 与 **外环 (Outer Loop)** 的协同驱动与知识反哺：

```
                    ┌──────────────────────────────────────────────┐
                    │               Outer Loop (外环)               │
                    │         人类工程师审查与架构知识沉淀             │
                    └──────────────┬───────────────────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
        [Pass]  ▼                                     ▼  [Reject]
    ┌───────────────────────┐            ┌───────────────────────────┐
    │ 推进到 Delivery 交付   │            │  触发 Human Feedback 协议  │
    │ PR 合并 / 归档         │            │  1. 记录审查意见           │
    └───────────────────────┘            │  2. 将意见转化为失败测试    │
                                         │  3. 修复代码使测试变绿     │
                                         │  4. 沉淀至 bug-ledger.yaml │
                                         └─────────────┬─────────────┘
                                                       │
  ┌────────────────────────────────────────────────────┴─────────────┐
  │                           Inner Loop (内环)                       │
  │                     AI 本地 TDD 极速迭代与机器门禁                  │
  │                                                                  │
  │   Step 0: 查阅 bug-ledger & gotchas (历史防御)                    │
  │   Step 1: RED (编写失败测试，验证由于功能缺失而挂掉)               │
  │   Step 2: GREEN (编写最简实现，禁止篡改测试)                      │
  │   Step 3: REFACTOR (重构优化，保持测试全绿且数量不减)             │
  │   Step 4: 机器自动验证 (check.mjs + Lint + Unit Test)             │
  └──────────────────────────────────────────────────────────────────┘
```

### 3.1 内环 (Inner Loop) —— 机器极速验证
- 目标：让 AI 在本地以最小代价、最高确定性完成单任务开发。
- 关键铁律：
  1. **禁止跳过 RED 阶段**：必须先写出因功能缺失而挂掉的测试。
  2. **禁止篡改既有测试**：不能为了让测试通过去弱化断言。
  3. **重构测试数量守恒**：重构后测试数量不得减少。
  4. **静态门禁自检**：运行 `check.mjs`，确保无文件名违规、无 `console.log` 等违禁代码。

### 3.2 外环 (Outer Loop) —— 人类在环与知识飞轮 (Knowledge Flywheel)
- 目标：人类工程师把控高阶设计、业务逻辑与架构演进，并将审阅成果转化为系统记忆。
- **Human Feedback Protocol (6 步闭环)**：
  - 人工审查拒绝时，AI **绝不允许直接改业务代码**！
  - 必须严格执行：`记录反馈` -> `转为失败测试` -> `确认测试挂掉` -> `修复实现` -> `沉淀进 bug-ledger.yaml` -> `重新提交`。
- **经验反哺机制**：每一次 Reject 的修复成果都会永久写入 `bug-ledger.yaml`，并在后续所有任务的 **内环 Step 0** 被强制读取，从而实现 **“系统不犯第二次同样的错误”**。

---

## 4. 配套 Excalidraw 可视化图表

为方便直观展示与分享，本设计已在 `docs/diagrams/` 目录下生成了 **5 套**高精度、全量元素对齐的 Excalidraw 架构设计图（由 `.harness/scripts/generate-excalidraw.mjs` 一键再生）：

| 序号 | 图表文件名 | 核心内容 |
|---|---|---|
| **01** | [`01-aclh-system-architecture.excalidraw`](file:///Users/hylas/Desktop/ai-coding-lifecycle-harness/docs/diagrams/01-aclh-system-architecture.excalidraw) | **全局系统架构与组件组织全景图**：展示多 Agent 适配层、配置编排、三大插件柱、项目记忆中枢、WIP 空间及自动化防线的完整组织关系。 |
| **02** | [`02-aclh-dual-loop-workflow.excalidraw`](file:///Users/hylas/Desktop/ai-coding-lifecycle-harness/docs/diagrams/02-aclh-dual-loop-workflow.excalidraw) | **双环验证机制与全生命周期工作流图**：展示六阶段状态机流水线、内环 TDD 步骤门禁、外环人工审查、6 步反馈转化协议及 Bug Ledger 回流闭环。 |
| **03** | [`03-aclh-context-knowledge-flywheel.excalidraw`](file:///Users/hylas/Desktop/ai-coding-lifecycle-harness/docs/diagrams/03-aclh-context-knowledge-flywheel.excalidraw) | **AI 上下文加载协议与知识飞轮数据流图**：展示严格的 0→5 阅读顺序流水线与历史经验自进化的知识飞轮数据流动。 |
| **04** | [`04-aclh-plugin-preset-composition.excalidraw`](file:///Users/hylas/Desktop/ai-coding-lifecycle-harness/docs/diagrams/04-aclh-plugin-preset-composition.excalidraw) | **插件化组织体系与预设装配逻辑图**：展示三大插件族（rules/process/templates）的逐一盘点、四个预设（full-lifecycle/testing-only/maintenance/quick-start）的装配矩阵，以及「plugins 手动组合 > preset 展开」的解析激活引擎。 |
| **05** | [`05-aclh-design-logic-e2e-chain.excalidraw`](file:///Users/hylas/Desktop/ai-coding-lifecycle-harness/docs/diagrams/05-aclh-design-logic-e2e-chain.excalidraw) | **设计逻辑与端到端执行链路图**：展示「五大痛点 → 五种机制回应 → 规则/流程/记忆/门禁四大支柱」，以及 Agent 从启动 → init-task → 内环 TDD → check.mjs → pre-commit → 外环审查 → 交付沉淀（含拒绝回绕）的完整执行链路。 |

> **打开方式**：
> 1. 在 VS Code 中安装 **Excalidraw 扩展** 直接双击 `.excalidraw` 文件查看与编辑。
> 2. 或者在浏览器中打开 [excalidraw.com](https://excalidraw.com)，点击菜单中的 **Open** 直接导入上述文件。
