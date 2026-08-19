# ACLH Task Adapter Lifecycle

This reference defines orchestration only. Repository Runtime scripts remain authoritative for validation and persistence.

## 1. Understand the request before initialization

Extract the irreducible goal, observable behavior, affected boundaries, and material ambiguities from the user's natural-language request.

If the user supplied a valid ACLH task ID, reuse it. Otherwise derive a concise uppercase kebab ID beginning with `TASK-`, for example `TASK-GOOGLE-AUTH-LOGIN`. Before using it, check `docs/wip/`; if the ID already exists, append the smallest numeric suffix that makes it unique.

Do not create task files yet.

## 2. Establish safe Git identity

Run `git status --short`, resolve the current branch, and inspect HEAD.

- Never initialize an ACLH task from detached HEAD.
- `$aclh-task` is a new-task entry point. For a new task, always create and switch to a dedicated `agent/<task-slug>` branch before `init-task.ts`, even when the Skill itself is being tested from another feature/adapter branch. The new task branch starts from the current HEAD so the repo-local Adapter remains available during branch testing.
- Reuse the current branch only when the request explicitly continues an existing ACLH task and `docs/wip/<TASK_ID>/.state.yaml` already binds that task to the current branch.
- If the target branch name already exists, append the smallest numeric suffix that makes it unique; do not silently attach a new task to an unrelated existing branch.
- If unrelated dirty changes would contaminate the task snapshot, stop before branch/task mutation and report the conflicting paths. Do not discard or hide user changes.

The dedicated branch must be stable before task initialization because ACLH binds task identity to branch + base commit.

## 3. Assess bootstrap metadata

Make a task-specific judgment; do not use a Classification-to-Skill lookup table.

### Classification

Use the repository Classification v1 contract:

- primary: `feature | bug | refactor | migration | integration`
- traits: only values accepted by the Classification Runtime
- confidence: `high | medium | low`
- source: `codex`

Record concise rationale and concrete ambiguities. Prefer `integration` as primary only when the dominant engineering purpose is crossing a system/provider boundary; a UI that happens to call an existing local API is not automatically an integration task.

### Risk

Use `.harness/governance.yaml` as the source of allowed levels. Assess delivery risk from scope and blast radius rather than task size alone.

Typical interpretation:

- `L0`: trivial/mechanical, negligible behavioral risk
- `L1`: low-risk local change
- `L2`: normal business development/default
- `L3`: high-risk or sensitive cross-boundary work where stronger human review is warranted

Authentication, authorization, sensitive persistence, schema/data migration, or critical cross-system changes are strong L3 signals, but still inspect the actual repository before deciding.

### P2 compatibility verification strategy

Choose exactly one currently supported strategy from `.harness/governance.yaml` as the dominant compatibility path:

- `tdd`: behavioral logic/defect flow where RED-GREEN-REFACTOR is meaningful
- `component`: UI component interaction/rendering flow
- `config`: configuration/schema/smoke flow
- `migration`: compatibility/rollback flow
- `docs`: documentation structure/example flow

For mixed tasks, choose the dominant existing P2 strategy; use P3 verification Skills for additional machine-evidence requirements. Do not pretend this single strategy describes the entire task.

## 4. Initialize the task workspace

Run:

```bash
node .harness/scripts/init-task.ts <TASK_ID> --risk <L0|L1|L2|L3> --strategy <strategy>
```

Do not hand-create `.state.yaml` or `evidence.json`.

## 5. Persist Classification

Create `docs/wip/<TASK_ID>/classification.yaml` using the Runtime's v1 schema, then run:

```bash
node .harness/scripts/classification.ts <TASK_ID> --verify
```

If validation fails, fix the artifact; do not weaken the validator.

## 6. Author the explicit Skill Plan

Inspect `.harness/skills/*.yaml`. Select only existing Skills whose capabilities are actually needed.

Create `docs/wip/<TASK_ID>/skill-plan.yaml` with:

```yaml
version: "1.0"
task_id: <TASK_ID>
classification:
  ref: classification.yaml
selected:
  - <explicit-skill-id>
```

Do not write `resolved` manually. Run:

```bash
node .harness/scripts/skill-plan.ts <TASK_ID> --resolve
node .harness/scripts/skill-plan.ts <TASK_ID> --verify
```

The Runtime owns dependency expansion and canonical ordering.

## 7. Generate Skill-aware Context

Run:

```bash
node .harness/scripts/context-select.ts <TASK_ID> --generate
```

Read the generated `context.json` and the selected source material needed for implementation. Do not replace bounded Context with eager loading of the entire knowledge base.

At this point show the user one compact bootstrap summary:

```text
Task: <TASK_ID>
Branch: <branch>
Classification: <primary + important traits>
Risk / strategy: <risk> / <strategy>
Skills: <resolved skills>
Important ambiguity: <only if material>
```

Then continue unless a material ambiguity makes safe implementation impossible.

## 8. Implement and verify

Implement the smallest safe solution. Maintain `spec.md`, `tasks.md`, `test-plan.md`, and task changelog as required by repository process.

Complete the selected P2 strategy markers and run:

```bash
node .harness/scripts/verification-plan.ts <TASK_ID>
```

For every resolved Skill output, inspect `.harness/artifacts/skill-outputs.yaml`, produce the required task-local artifact/sections, then run:

```bash
node .harness/scripts/skill-output.ts <TASK_ID> --verify
```

Structural Skill output completion is not semantic proof.

## 9. Refresh Context after governed content stabilizes

Implementation changes can invalidate P3 Context freshness. After code and task artifacts are stable, regenerate and verify Context:

```bash
node .harness/scripts/context-select.ts <TASK_ID> --generate
node .harness/scripts/context-select.ts <TASK_ID> --verify
```

Do this before final Evidence recording.

## 10. Record canonical Evidence

Use `.harness/governance.yaml`, `.state.yaml`, and `.harness/policies/skill-evidence.yaml` to determine the union of gates required by risk and resolved verification Skills.

Record only required canonical gates using:

```bash
npm run evidence -- <TASK_ID> --gate check
npm run evidence -- <TASK_ID> --gate typecheck
npm run evidence -- <TASK_ID> --gate test
```

Run only the gates required by the union; do not claim a gate ran unless Evidence records it.

Then verify both dimensions:

```bash
npm run evidence -- <TASK_ID> --verify
node .harness/scripts/skill-evidence.ts <TASK_ID> --verify
```

If repository/task content changes afterward, regenerate any stale Context/Evidence rather than bypassing freshness.

## 11. Review and delivery boundary

Follow risk policy in `.harness/governance.yaml` / `AGENTS.md`.

When Builder self-review is required:

```bash
node .harness/scripts/self-review.ts <TASK_ID>
```

For L2/L3, prepare Independent Review:

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --prepare
```

The current Builder context must not create an independent PASS. Stop and report that a fresh Codex context or human reviewer must supply the independent review artifact. L3 requires the reviewer kind permitted by current risk policy.

After a genuinely independent review exists, the delivery gate is:

```bash
node .harness/scripts/delivery-gate.ts <TASK_ID>
```

For tasks whose risk policy does not require independent review, run the delivery gate directly after all prior gates are fresh.

## 12. Completion report

Report only concrete state:

- task ID and branch
- implementation summary
- Classification and selected/resolved Skills
- machine gates actually recorded
- delivery gate result, or the exact Independent Review boundary still pending

Never report `PASS` for a gate that was not executed and recorded.
