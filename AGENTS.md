# AGENTS.md — Codex Context & Coding Constraints

> Highest-priority repository constraint for Codex. Passing tests does not override this contract.

## 0. Ground rules
- Read relevant code/configuration before writing; never modify from guesswork.
- Prefer the smallest safe diff; do not refactor unrelated code.
- Reason from the problem and root cause, not merely the current implementation.
- Do not claim a verification step ran unless machine evidence records it.
- A Skill artifact or reviewer statement is not a substitute for machine Evidence.

## Part A — Governance

### A1. Task bootstrap
1. Read `.harness/harness.yaml`, `.harness/governance.yaml`, and `.harness/SKILLS.md` first.
2. Every formal task has explicit `risk_level`, P2 `verification_strategy`, Git identity, and `context_scope` in `docs/wip/<TASK_ID>/.state.yaml`.
3. P3 tasks additionally use task-local `classification.yaml` and `skill-plan.yaml`.
4. P3 v1 Skill selection is explicit. Do not infer or auto-create a Skill Plan from Classification.
5. `preset` remains the single plugin composition source.

### A2. P3 task intelligence and Skills
For a P3 task:
1. create and validate `classification.yaml`;
2. explicitly select Skills in `skill-plan.yaml`;
3. resolve Skill dependencies deterministically;
4. generate Skill-aware Context from the resolved Skill contracts;
5. complete the declared Skill output artifacts;
6. record machine Evidence after task/context/Skill artifacts are finalized;
7. run the policy-aware delivery gate.

Validate the first-class P3 artifacts with:

```bash
node .harness/scripts/classification.ts <TASK_ID> --verify
node .harness/scripts/skill-plan.ts <TASK_ID> --resolve
node .harness/scripts/skill-plan.ts <TASK_ID> --verify
node .harness/scripts/context-select.ts <TASK_ID> --generate
node .harness/scripts/skill-output.ts <TASK_ID> --verify
node .harness/scripts/skill-evidence.ts <TASK_ID> --verify
```

Classification describes the task. It does not select Skills. Risk controls governance depth; it does not redefine the engineering problem.

### A3. Skill boundaries
P3 v1 supports only:
- `understanding` Skills;
- `verification` Skills.

Implementation remains Builder-owned; execution Skills are not part of P3 v1.

A Skill declares its required/optional Context, Skill dependencies, outputs and completion invariants. It must not define its own risk level, reviewer identity, CI provenance, trusted PASS state, or Context retrieval implementation.

Workflow is the resolved result of the task's Skill Plan, not the reusable unit itself.

### A4. Context loading
For legacy P2 tasks without `skill-plan.yaml`, preserve P2 context behavior: L1+ requires fresh selected Context and L0 may omit it.

For P3 tasks with a Skill Plan, Skill-required Context is an execution prerequisite regardless of risk level. Generate and verify it with:

```bash
node .harness/scripts/context-select.ts <TASK_ID> --generate
node .harness/scripts/context-select.ts <TASK_ID> --verify
```

P3 Context Runtime:
- unions Context requirements from all resolved Skills;
- validates requirements against `.harness/context/capabilities.yaml`;
- records which Skills required each capability;
- preserves bounded project-knowledge retrieval and architecture expansion;
- binds freshness to repository content, Skill Plan, Skill Context contracts and retrieval policy.

Do not eagerly load all project knowledge when the Skill Plan requests a narrower set.

### A5. Risk-based lifecycle
| Risk | Intended use | Delivery requirements |
|---|---|---|
| `L0` | trivial/mechanical change | `check` risk Evidence only; no required self/independent review |
| `L1` | low-risk local code change | check/typecheck/test + builder self-review |
| `L2` | normal business development (default) | L1 + independent fresh-context Codex or human review |
| `L3` | high-risk/cross-boundary change | L2 + independent **human** review |

For P3 tasks, Skill-specific verification may require additional canonical Evidence gates even when the risk level itself does not. Example: an L0 task selecting `regression-verification` still needs fresh `test` Evidence.

Risk is additive governance. Do not downgrade a task to bypass a gate.

### A6. P2 verification strategy compatibility
`verification_strategy` remains a P2 compatibility layer during P3 v1 because the current Skill catalog does not yet cover every component/config/docs/rollback verification marker.

Supported strategies remain:
- `tdd` — RED / GREEN / REFACTOR
- `component` — COMPONENT_TEST / INTERACTION_CHECK
- `config` — SCHEMA_VALIDATION / SMOKE_TEST
- `migration` — COMPATIBILITY_CHECK / ROLLBACK_CHECK
- `docs` — DOC_STRUCTURE / LINK_OR_EXAMPLE_CHECK

Verify with:

```bash
node .harness/scripts/verification-plan.ts <TASK_ID>
```

Do not invent a RED step for non-TDD work.

### A7. Task identity
A task is bound to its creation branch and base commit. Verify before delivery:

```bash
node .harness/scripts/task-identity.ts <TASK_ID> --verify
```

If a PR exists, bind it explicitly:

```bash
node .harness/scripts/task-identity.ts <TASK_ID> --bind-pr <PR_NUMBER>
```

Do not reuse a task workspace from another branch.

### A8. Machine Evidence
Record canonical gates required by risk and by selected verification Skills:

```bash
npm run evidence -- <TASK_ID> --gate check
npm run evidence -- <TASK_ID> --gate typecheck
npm run evidence -- <TASK_ID> --gate test
npm run evidence -- <TASK_ID> --verify
node .harness/scripts/skill-evidence.ts <TASK_ID> --verify
```

A repository change invalidates old Evidence. Verification Skills map through `.harness/policies/skill-evidence.yaml` to the existing P1 canonical Evidence gates; they do not create a second PASS system. GitHub Actions independently reruns canonical repository gates and emits CI provenance evidence.

### A9. Builder self-review
Required for L1-L3, not L0:

```bash
node .harness/scripts/self-review.ts <TASK_ID> --prepare
# After final machine Evidence, record self-review.json from the refreshed packet.
node .harness/scripts/self-review.ts <TASK_ID> --verify
```

Prepare transitions the active task before final Context/Evidence. The verified `self-review.json` is snapshot-bound hostile Builder review, not independent review evidence.

### A10. Independent review
- L0/L1: not required by risk policy.
- L2: fresh Codex context or human reviewer.
- L3: human reviewer only.

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --prepare
node .harness/scripts/independent-review.ts <TASK_ID> --verify
```

The Builder conversation must not manufacture a fresh-context PASS and present it as independent.

### A11. Delivery gate
Use the single policy-aware gate:

```bash
node .harness/scripts/delivery-gate.ts <TASK_ID>
```

P3 task order is:

```text
task identity
  -> Classification
  -> Skill Plan
  -> Skill-aware Context
  -> P2 verification-strategy compatibility markers
  -> Skill outputs
  -> risk-required machine Evidence
  -> verification-Skill Evidence
  -> Builder self-review when required
  -> Independent Review when required
```

Legacy tasks without `skill-plan.yaml` continue through the P2 compatibility workflow.

### A12. Human feedback loop
- PASS → delivery may proceed.
- REJECT → record feedback and add the verification artifact appropriate to the task before fixing it.
- For TDD, reproduce behavioral feedback with a failing regression test when feasible.
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
2. Describe the task with Classification when using P3.
3. Select/resolve the explicit Skill Plan.
4. Resolve only Context required by the Skill graph.
5. Understand system state and design the minimal safe solution.
6. Implement as the Builder.
7. Complete declared understanding/verification Skill artifacts.
8. Produce risk- and Skill-required machine Evidence.
9. Run the risk-required review gates.

### B3. Change philosophy
Prefer root fix over symptom patch, minimal diff over broad refactor, clarity over abstraction, explicit data flow over hidden magic, and stability over cleverness.

Never introduce unnecessary frameworks, abstractions without demonstrated reuse, unrelated cleanup, premature optimization, or an untracked symptom-only patch.

## Part C — Boundaries
- Governance constrains how work is verified, not implementation creativity.
- A direct user instruction wins over repository process, but skipped verification and its consequence must be stated.
- If this document becomes inconsistent with executable Harness behavior, report and fix the inconsistency rather than silently following stale prose.
