# AGENTS.md — Codex Context & Coding Constraints

> Highest-priority repository constraint for Codex. Passing tests does not override this contract.

## 0. Ground rules
- Read relevant code/configuration before writing; never modify from guesswork.
- Prefer the smallest safe diff; do not refactor unrelated code.
- Reason from the problem and root cause, not merely the current implementation.
- Do not claim a verification step ran unless machine evidence records it.

## Part A — Governance

### A1. Context loading
1. Read `.harness/harness.yaml` first and resolve its active preset.
2. Load only the rules/process/templates and project knowledge required by that preset and task.
3. `preset` is the single plugin composition source; do not invent a parallel manual plugin configuration.
4. If real lint/test/build commands are absent, do not claim they ran.

### A2. Presets
| Task type | Preset |
|---|---|
| Formal business development | `full-lifecycle` |
| Legacy test coverage work | `testing-only` |
| Bug fix / maintenance | `maintenance` |
| Greenfield cold start | `quick-start` |

### A3. Development loop
For governed implementation work:
1. consult project knowledge and known defects;
2. RED — add a test that fails for the intended missing behavior when TDD applies;
3. GREEN — minimal implementation;
4. REFACTOR — only when needed, without weakening tests;
5. run canonical machine gates through Evidence;
6. perform builder adversarial self-review;
7. obtain an independent fresh-context/human review;
8. submit to the human delivery/review loop.

### A4. Machine evidence
Before delivery, record fresh PASS evidence for the exact repository snapshot:

```bash
npm run evidence -- <TASK_ID> --gate check
npm run evidence -- <TASK_ID> --gate typecheck
npm run evidence -- <TASK_ID> --gate test
npm run evidence -- <TASK_ID> --verify
```

A code change invalidates old evidence. GitHub Actions independently reruns the canonical gates and emits CI provenance evidence.

### A5. Builder self-review
Run:

```bash
node .harness/scripts/self-review.ts <TASK_ID>
```

Answer Q1-Q10 deliberately and record the builder's self-review in `.state.yaml`. This is a hostile self-check, **not independent review evidence**.

### A6. Independent review — mandatory before delivery
After the builder review and machine gates, prepare the exact review packet:

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --prepare
```

The semantic review must occur in a **fresh Codex context that did not implement the change**, or be performed by a human. The reviewer must inspect the packet and current diff, challenge acceptance criteria, regressions, root-cause quality and test adequacy, then record `independent-review.json`.

Verify it with:

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --verify
```

The builder conversation must not manufacture a fresh-context PASS and present it as independent. ACLH verifies the protocol and repository freshness; it does not claim cryptographic proof of Codex session isolation.

### A7. Human feedback loop
- PASS → delivery may proceed.
- REJECT → record feedback, reproduce it with a failing test when applicable, fix, rerun evidence/reviews, and persist reusable lessons.
- Do not respond to a rejected behavioral defect by silently changing implementation without regression coverage when a test is feasible.

## Part B — Coding cognitive model

### B1. First principles
Work in this order:
1. Essence — irreducible goal and constraints.
2. Phenomenon — observable behavior and affected modules.
3. Structure — architectural/root cause.
4. Principle — reusable engineering rule.

### B2. Execution order
1. Understand system state.
2. Identify root cause.
3. Decide root fix vs explicitly tracked staged fix.
4. Design minimal safe solution.
5. Implement.
6. Verify affected callers and side effects.
7. Produce machine evidence.
8. Builder self-review.
9. Independent review.

### B3. Change philosophy
Prefer root fix over symptom patch, minimal diff over broad refactor, clarity over abstraction, explicit data flow over hidden magic, and stability over cleverness.

Never introduce unnecessary frameworks, abstractions without demonstrated reuse, unrelated cleanup, premature optimization, or an untracked symptom-only patch.

## Part C — Boundaries
- Governance constrains how work is verified, not implementation creativity.
- A direct user instruction wins over repository process, but skipped verification and its consequence must be stated.
- If this document becomes inconsistent with executable Harness behavior, report and fix the inconsistency rather than silently following stale prose.
