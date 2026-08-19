# AGENTS.md — Codex Context & Coding Constraints

> Highest-priority repository constraint for Codex. Passing tests does not override this contract.

## 0. Ground rules
- Read relevant code/configuration before writing; never modify from guesswork.
- Prefer the smallest safe diff; do not refactor unrelated code.
- Reason from the problem and root cause, not merely the current implementation.
- Do not claim a verification step ran unless machine evidence records it.

## Part A — Governance

### A1. Task bootstrap and context loading
1. Read `.harness/harness.yaml` and `.harness/governance.yaml` first.
2. Every formal task has explicit `risk_level`, `verification_strategy`, Git identity, and `context_scope` in `docs/wip/<TASK_ID>/.state.yaml`.
3. For L1+ tasks, generate task context with `node .harness/scripts/context-select.ts <TASK_ID> --generate`; use `context.json` instead of eagerly loading every project knowledge file.
4. Context selection derives changed files from the task base commit, maps them to architecture modules plus one-hop dependencies, and retrieves bounded relevant knowledge.
5. `preset` remains the single plugin composition source; project lists in presets are retrieval candidates, not automatic full-file context injection.

### A2. Risk-based lifecycle
| Risk | Intended use | Delivery requirements |
|---|---|---|
| `L0` | trivial/mechanical change | `check` evidence only; no required self/independent review |
| `L1` | low-risk local code change | fresh context + check/typecheck/test + builder self-review |
| `L2` | normal business development (default) | L1 + independent fresh-context Codex or human review |
| `L3` | high-risk/cross-boundary change | L2 + independent **human** review |

Risk is an additive governance level. Do not downgrade a task merely to bypass a gate.

### A3. Task-dependent verification strategy
TDD is one verification strategy, not a universal ritual. The task's `.state.yaml` selects one of:

- `tdd` — RED → GREEN → REFACTOR for behavioral logic and defects.
- `component` — component test + interaction/smoke verification.
- `config` — schema validation + smoke verification.
- `migration` — compatibility + rollback verification.
- `docs` — structure + link/example verification.

`test-plan.md` contains the required markers for the selected strategy. Complete them and verify with:

```bash
node .harness/scripts/verification-plan.ts <TASK_ID>
```

Do not invent a RED step for work where the selected strategy is not `tdd`.

### A4. Task identity
A task is bound to its creation branch and base commit. Verify before delivery:

```bash
node .harness/scripts/task-identity.ts <TASK_ID> --verify
```

If a PR exists, bind it explicitly:

```bash
node .harness/scripts/task-identity.ts <TASK_ID> --bind-pr <PR_NUMBER>
```

Do not reuse a task workspace from another branch.

### A5. Machine evidence
Record the canonical gates required by the task's risk level. L1-L3 require all three; L0 requires `check` only:

```bash
npm run evidence -- <TASK_ID> --gate check
npm run evidence -- <TASK_ID> --gate typecheck
npm run evidence -- <TASK_ID> --gate test
npm run evidence -- <TASK_ID> --verify
```

A repository change invalidates old evidence. GitHub Actions independently reruns the canonical repository gates and emits CI provenance evidence.

### A6. Builder self-review
Required for L1-L3, not L0:

```bash
node .harness/scripts/self-review.ts <TASK_ID>
```

Answer Q1-Q10 deliberately and record the builder's self-review in `.state.yaml`. This is a hostile self-check, **not independent review evidence**.

### A7. Independent review
- L0/L1: not required by the risk policy.
- L2: fresh Codex context or human reviewer.
- L3: human reviewer only.

Prepare and verify:

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --prepare
node .harness/scripts/independent-review.ts <TASK_ID> --verify
```

The builder conversation must not manufacture a fresh-context PASS and present it as independent. ACLH verifies protocol declarations and repository freshness; it does not claim cryptographic proof of Codex session isolation.

### A8. Delivery gate
Use the single policy-aware gate:

```bash
node .harness/scripts/delivery-gate.ts <TASK_ID>
```

It verifies, in order: task identity → fresh selected context when required → verification strategy → required machine evidence → builder self-review when required → independent review when required.

### A9. Human feedback loop
- PASS → delivery may proceed.
- REJECT → record feedback and add the verification artifact appropriate to the task strategy before fixing the defect.
- For `tdd`, reproduce behavioral feedback with a failing regression test when feasible.
- For non-TDD strategies, add the corresponding component/schema/smoke/compatibility/docs verification instead of fabricating a unit-test RED step.
- Persist reusable lessons into structured project knowledge.

## Part B — Coding cognitive model

### B1. First principles
Work in this order:
1. Essence — irreducible goal and constraints.
2. Phenomenon — observable behavior and affected modules.
3. Structure — architectural/root cause.
4. Principle — reusable engineering rule.

### B2. Execution order
1. Bootstrap task governance and identity.
2. Generate/select relevant context instead of loading the whole project knowledge base.
3. Understand system state and identify root cause.
4. Design the minimal safe solution.
5. Execute the declared verification strategy while implementing.
6. Verify affected callers and side effects.
7. Produce risk-required machine evidence.
8. Run the risk-required review gates.

### B3. Change philosophy
Prefer root fix over symptom patch, minimal diff over broad refactor, clarity over abstraction, explicit data flow over hidden magic, and stability over cleverness.

Never introduce unnecessary frameworks, abstractions without demonstrated reuse, unrelated cleanup, premature optimization, or an untracked symptom-only patch.

## Part C — Boundaries
- Governance constrains how work is verified, not implementation creativity.
- A direct user instruction wins over repository process, but skipped verification and its consequence must be stated.
- If this document becomes inconsistent with executable Harness behavior, report and fix the inconsistency rather than silently following stale prose.
