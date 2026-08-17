# AI Agents Context (AI 代理上下文)

This project uses the AI Coding Lifecycle Harness (ACLH). All AI agents MUST read this document and follow the reading order and constraints below.

本项目使用 AI Coding Lifecycle Harness (ACLH) 架构。所有 AI 代理在执行任务前**必须**阅读本文档，并遵循以下阅读顺序和约束。

## 0. Initial Context Loading (初始上下文加载)

为了确保使用正确的规范：
1. **FIRST** read `.harness/harness.yaml` to determine which preset/plugins are active.
2. **ONLY** read the plugins listed there.
3. Be aware that `.harness/scripts/check.mjs` is available for validation.
4. Be aware that `.harness/hooks/pre-commit.sh` exists.

## 1. Reading Order (阅读顺序)

为了确保你拥有足够的信息来完成任务，请按以下顺序读取项目文件：

1. **Project Context (项目上下文)**: 
   - `.harness/project/profile.yaml` (项目基础信息与目标)
   - `.harness/project/architecture.yaml` (技术栈与架构)
2. **Historical Knowledge (历史经验积累)**:
   - `.harness/project/bug-ledger.yaml` (历史 Bug 及防范)
   - `.harness/project/gotchas.yaml` (暗坑与注意事项)
   - `.harness/project/decisions.yaml` (架构与技术决策)
   - `.harness/project/dev-notes.yaml` (开发备忘录)
3. **Coding Standards (编码规范)**:
   - `.harness/plugins/rules/` 目录下的所有应用规则
4. **Development Process (开发流程)**:
   - `.harness/plugins/process/` 目录下的流程约束
5. **Templates (模板)**:
   - `.harness/plugins/templates/` 目录下的生成模板

## 2. Dual-loop Verification (双环验证机制)

本项目严格执行“双环验证”以保证代码质量，所有 AI 代理必须遵循此机制：

- **Inner Loop (内环 - TDD/机器验证)**: 必须先编写测试（TDD），并且代码必须通过所有的 Linter, 单元测试和构建流程。不要提交未经验证的代码。
- **Outer Loop (外环 - 人工审查)**: 所有重要的架构变更、复杂业务逻辑实现，以及 Pull Request 必须经过人工审查 (Human Review)。

## 3. Key Commands (关键命令)

在开发过程中，请使用以下标准命令（具体细节待填充）：

- **Install**: `npm install` / `pnpm install` / `yarn` (TODO: 确认包管理器)
- **Dev**: `npm run dev` / `pnpm dev` / `yarn dev`
- **Build**: `npm run build` / `pnpm build` / `yarn build`
- **Test**: `npm test` / `pnpm test` / `yarn test`
- **Lint**: `npm run lint` / `pnpm lint` / `yarn lint`
