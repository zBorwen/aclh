# AI Coding Lifecycle Harness (ACLH)

一套把 AI 编码过程约束在 **规则 (Rules) + 流程 (Process) + 记忆 (Memory) + 门禁 (Guardrails)** 四条轨道上的工程治理模板。当前阶段只适配 **OpenAI Codex**，通过仓库根目录的 `AGENTS.md` 作为统一入口，在真实项目中约束 Codex 稳定地产出可审查、可复用、低返工的代码。

> 设计全景见 [`HARNESS_ANALYSIS.md`](HARNESS_ANALYSIS.md)；Codex 行为约束见 [`AGENTS.md`](AGENTS.md)（最高优先级）。

---

## 目录结构

```text
.
├── AGENTS.md                  # Codex 最高约束：治理层 + 行为层
├── HARNESS_ANALYSIS.md        # 架构深度分析文档（静态图后续统一更新）
├── .harness/
│   ├── harness.yaml           # preset / 插件装配
│   ├── ENFORCEMENT.md         # advisory / verifiable / blocking 契约
│   ├── EVIDENCE.md            # P1 Evidence Model + trust boundary
│   ├── plugins/
│   │   ├── rules/
│   │   ├── process/
│   │   └── templates/
│   ├── project/
│   ├── scripts/
│   │   ├── check.ts
│   │   ├── init-task.ts
│   │   ├── evidence.ts        # 本地 task evidence
│   │   ├── ci-evidence.ts     # GitHub Actions 独立 evidence verifier
│   │   └── self-review.ts
│   └── hooks/
├── docs/wip/                  # task workspace + evidence.json
└── diagrams/                  # 静态架构图，阶段稳定后统一更新
```

## 当前 Agent 适配范围

- **Supported:** OpenAI Codex（`AGENTS.md` + `.harness/`）
- **Not supported for now:** Cursor、GitHub Copilot、Claude Code 专用入口
- 当前优先稳定 Codex 的治理、门禁和证据链，其他 Agent 后续再评估。

## 核心机制

- **双环验证**：内环由 Codex + TDD + machine gates 闭环；外环由人工 review 把关。
- **对抗式自检**：提交人工审查前运行 `self-review.ts`，主动检查遗漏、假设、影响范围和根因。
- **本地机器证据**：`evidence.ts` 执行 `check / typecheck / test`，把 PASS 绑定到 `HEAD SHA + worktree SHA-256`；代码变化后旧证据立即 stale。
- **独立 CI 证据**：`ci-evidence.ts` 在 GitHub Actions 内独立重跑相同 canonical gates，记录 GitHub run provenance，并上传 CI evidence artifact；不会信任 task-local `evidence.json`。
- **知识飞轮**：人工 review 的失败和经验进入 bug-ledger / gotchas，供后续任务使用。
- **预设装配**：`harness.yaml` 根据任务类型选择 preset，加载相应规则、流程和模板。

## 快速开始

```bash
npm install
npm run typecheck

node .harness/scripts/check.ts
node .harness/scripts/init-task.ts JIRA-101

# Local Evidence
npm run evidence -- JIRA-101 --gate check
npm run evidence -- JIRA-101 --gate typecheck
npm run evidence -- JIRA-101 --gate test
npm run evidence -- JIRA-101 --verify

node .harness/scripts/self-review.ts JIRA-101
```

GitHub Actions 的 `Harness CI` 会独立执行同样的 `check / typecheck / test`，并上传 `.harness/artifacts/ci-evidence.json` 作为 workflow artifact。

## P1 Evidence Layer

P1 按以下顺序完成：

1. **Execution evidence**：真实执行 canonical command，记录时间、exit code、PASS/FAIL。
2. **Freshness binding**：证据绑定 commit SHA + worktree fingerprint，防止修改代码后复用旧 PASS。
3. **Evidence-backed blocking**：`check / typecheck / test` 成为任务交付前的 blocking workflow gates。
4. **Independent CI provenance**：GitHub Actions 不消费本地 evidence，而是独立执行 gates 并记录 repository / commit / run / workflow / actor provenance。

P1 到这里结束。详细信任边界见 `.harness/EVIDENCE.md`。

## 设计决策与注意事项

1. **配置模板初始为空**：真实项目接入时先填 `project/profile.yaml`、`architecture.yaml` 和项目命令。
2. **AGENTS.md 是当前唯一 Agent contract**：只适配 Codex，避免过早承担多 Agent 兼容成本。
3. **第一性原理优先**：优先根因修复；无法一次根治时要记录明确终态。
4. **任务提交双门禁**：fresh local evidence → adversarial self-review → human review。
5. **Local Evidence 不是独立 attestation**：仓库写入者可以编辑 `evidence.json`，因此只作为本地工作流证据。
6. **CI Evidence 与 Local Evidence 分离**：CI 使用 GitHub Actions 环境提供的 provenance 独立生成 artifact，不接受本地 JSON 作为可信输入。
7. **Branch protection 是仓库管理设置**：若要在 GitHub 层阻止 failing PR merge，应将 `Harness CI / verify` 配置为 required check；Harness 本身负责确定性的非零失败语义。
8. **Semgrep 尚未接入**：当前仍使用 ACLH 自有轻量 check engine；不插入 P1 范围。
9. **Git hooks 仍是本地快速反馈层**：真实项目建议结合 GitHub required checks，而不是把 hook 当最终可信边界。
10. **静态架构图延后统一更新**：等后续核心模型稳定后一次性刷新。

## 当前状态（2026-08）

- Agent 适配：Codex only
- P0：完成
- P1 Evidence Layer：**完成**
- Local evidence：execution + freshness + blocking
- CI evidence：independent GitHub Actions provenance + artifact
- Semgrep：未接入
- 静态架构图：暂未更新
