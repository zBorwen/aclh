# ACLH P2 Governance Scaling

P2 makes governance proportional to risk and keeps task context bounded as the repository grows.

## Risk levels

| Risk | Machine gates | Context | Builder self-review | Independent review |
|---|---|---|---|---|
| L0 | check | optional | no | no |
| L1 | check + typecheck + test | required/fresh | optional | fresh Codex or human |
| L2 | check + typecheck + test | required/fresh | optional | fresh Codex or human |
| L3 | check + typecheck + test | required/fresh | optional | human only |

Default risk is L2. A task must not be downgraded merely to bypass a gate.

## Verification strategies

TDD is task-dependent. `verification_strategy` selects the required markers in `test-plan.md`:

- `tdd`: RED / GREEN / REFACTOR
- `component`: COMPONENT_TEST / INTERACTION_CHECK
- `config`: SCHEMA_VALIDATION / SMOKE_TEST
- `migration`: COMPATIBILITY_CHECK / ROLLBACK_CHECK
- `docs`: DOC_STRUCTURE / LINK_OR_EXAMPLE_CHECK

`verification-plan.ts` blocks delivery until the selected strategy's markers are completed.

## Task identity

`init-task.ts` binds a task to the current branch and base commit. `task-identity.ts --verify` prevents a WIP workspace from silently moving across branches and checks that the base commit remains an ancestor. `--bind-pr` records an optional PR number and CI validates the PR context when available.

## Dynamic context

For L1+ tasks, run:

```bash
node .harness/scripts/context-select.ts <TASK_ID> --generate
```

The selector combines:

1. changed files since the task base commit;
2. explicit `context_scope` module/tag/file hints;
3. architecture path matching;
4. one-hop module dependencies;
5. bounded project-knowledge retrieval.

`context.json` is bound to the current scope/change-set hash. `--verify` rejects stale context.

## Knowledge retrieval

Knowledge is not injected wholesale. Bug ledger, gotchas and ADR entries are ranked by deterministic metadata relevance:

- module match
- affected-file/apply-to match
- tag/category match
- high/critical severity bonus

Each source is capped by `knowledge_retrieval.max_items_per_source` in `governance.yaml`. The output records both selected items and total matches so truncation is visible.

Recommended metadata:

- bugs: `module`/`modules`, `tags`, `affected_files`, `severity`
- gotchas: `modules`, `tags`/`category`, `applies_to`
- ADRs: `modules`, `tags`

## Delivery order

After implementation stabilizes, `builder-finalize.ts <TASK_ID> --json` is the
preferred bounded Builder transition. It refreshes Context and records only the
policy/Skill/Verification-Gap requirements. Browser proof is explicit opt-in, not
a default post-task check.

`delivery-gate.ts` is the policy-aware entry point:

```text
task identity
  -> fresh selected context when required
  -> authored spec.md -> plan.md -> tasks.md
  -> declared verification strategy
  -> risk-required machine evidence
  -> independent review when required
  -> explicit user accept or Repair decision
```

P2 intentionally does not add Semgrep, AST dependency enforcement, dashboards or semantic/vector retrieval. Those remain later-phase work.
