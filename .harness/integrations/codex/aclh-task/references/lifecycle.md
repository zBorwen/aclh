# ACLH External Task Lifecycle

This is orchestration for an attached consumer project. ACLH Runtime implementation remains under `ACLH_RUNTIME_ROOT`; task state and Git operations remain in the consumer `PROJECT_ROOT`.

For every Runtime transition below, execute the Engine-owned script with the consumer project explicitly bound:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/<script>.ts" ...
```

Never copy Engine scripts, Skill contracts, policies, registries, or templates into the consumer to make a command available.

## 1. Understand the request

Extract the irreducible goal, observable behavior, affected boundaries, and material ambiguities. If the user supplies a valid Task ID, reuse it; otherwise derive a concise unique `TASK-...` ID by checking consumer `docs/wip/`.

## 2. Establish safe Git identity in the consumer

Inspect consumer `git status`, branch, and HEAD.

- Never initialize from detached HEAD.
- New tasks get a dedicated `agent/<task-slug>` branch before initialization.
- Reuse the branch only when explicitly continuing an existing ACLH task already bound to it.
- Do not discard, stash, or hide unrelated human changes to make the task appear clean.

## 3. Resynchronize a continuing Task

For an existing ACLH Task, inspect the Git-local managed checkpoint:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/managed-snapshot.ts" <TASK_ID> --status --json
```

- `clean`: continue with existing Task state.
- `unknown`: do not invent a historical checkpoint; continue cautiously and establish the next checkpoint only after intentional review.
- `changed`: prepare Resync:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/resync.ts" <TASK_ID> --prepare --json
```

Treat out-of-band changes as valid human work. Keep the overall Task Classification unchanged and explicitly reconsider Engineering Skills. There is no deterministic Classification-to-Skill mapping.

If the existing Skill Plan still covers the work:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-replan.ts" <TASK_ID> --record unchanged --source codex
```

If the required capabilities changed, edit explicit `selected`, then:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --resolve
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --verify
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-replan.ts" <TASK_ID> --record changed --source codex
```

Always verify the handoff checkpoint:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-replan.ts" <TASK_ID> --verify
```

Runtime verifies whether `changed|unchanged` matches the semantic Skill Plan baseline, but Runtime never chooses Skills automatically.

## 4. Assess metadata for a new Task

For a new Task, use Engine contracts rather than a Classification-to-Skill lookup table.

- Classification primary: `feature | bug | refactor | migration | integration`.
- Assess risk from `$ACLH_RUNTIME_ROOT/.harness/governance.yaml`.
- Choose the dominant P2 compatibility verification strategy from Engine governance.
- Classification describes the overall Task; it does not select Engineering Skills.

## 5. Initialize new consumer task state

For a new Task only:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/init-task.ts" <TASK_ID> --risk <LEVEL> --strategy <STRATEGY>
```

Do not hand-create `.state.yaml` or `evidence.json`.

## 6. Persist and verify Classification

For a new Task, create consumer `docs/wip/<TASK_ID>/classification.yaml`, then:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/classification.ts" <TASK_ID> --verify
```

For a continuing Task, verify the existing Classification instead of rewriting it because the newest feedback happens to describe a bug or refactor.

## 7. Author or verify the explicit Skill Plan

Inspect Engine `$ACLH_RUNTIME_ROOT/.harness/skills/*.yaml`. For a new Task, create `skill-plan.yaml` with explicit `selected` Skills only; do not write `resolved` manually.

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --resolve
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --verify
```

A continuing changed Task must already have completed the Re-plan checkpoint from step 3.

## 8. Verify Context source readiness

Before Scope or Context selection, inspect the Context capabilities required by the resolved Skill Plan:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-readiness.ts" <TASK_ID> --verify --json
```

Readiness is deterministic and structural:

- `ready`: the source satisfies its minimal Runtime contract.
- `missing`: the source file does not exist.
- `present-but-unusable`: the file exists but cannot safely satisfy the capability.

A required source that is not `ready` blocks Context. Optional unavailable sources do not block. An empty knowledge ledger with a valid `entries: []` schema is a legitimate ready state.

At P4.11, do not fabricate semantic project Context merely to make readiness pass. Report the required blocker if the repository does not yet contain usable project profile/architecture data. Project Context bootstrap is a later capability.

## 9. Generate and verify Context Scope

Scope owns the task boundary before Context retrieval:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-scope.ts" <TASK_ID> --generate
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-scope.ts" <TASK_ID> --verify
```

Scope combines business changed files with explicit task scope, maps files to project architecture modules, and expands dependencies exactly one hop from the frozen seed set. Context must consume the resolved Scope rather than silently widening it.

## 10. Generate or refresh Skill-aware Context

Project-specific Context state belongs to the consumer; Skill/context contracts remain Engine-owned.

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --generate
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --verify
```

Read only the bounded selected Context. Show a compact bootstrap/resync summary, then continue unless a material ambiguity prevents safe work.

## 11. Implement and produce governed outputs

Implement the smallest safe solution in the consumer. Maintain `spec.md`, `tasks.md`, `test-plan.md`, and `changelog.md`.

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/verification-plan.ts" <TASK_ID>
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-output.ts" <TASK_ID> --verify
```

Skill output structure is not semantic proof. After code/task content stabilizes, run readiness again if project Context changed, then regenerate/verify Scope and Context before final Evidence.

## 12. Record canonical machine Evidence

Determine the union of risk-required and verification-Skill-required gates. For each required gate:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --gate <check|typecheck|test>
```

External `check` executes the Engine checker against consumer source; `typecheck` and `test` execute consumer canonical npm scripts. Record only gates that truly ran.

Then verify both Evidence dimensions:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --verify
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-evidence.ts" <TASK_ID> --verify
```

## 13. Review, managed handoff, and delivery boundary

When risk requires Builder self-review:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/self-review.ts" <TASK_ID>
```

For L2/L3 prepare Independent Review:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/independent-review.ts" <TASK_ID> --prepare
```

Before Builder stops for a fresh reviewer, record the last intentionally managed state:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/managed-snapshot.ts" <TASK_ID> --record
```

The managed snapshot is synchronization state, not Evidence or a review PASS. Builder context must not manufacture an independent PASS. Stop for a genuinely fresh Codex context or human reviewer; L3 remains human-only.

After required independent review exists:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/delivery-gate.ts" <TASK_ID>
```

Delivery re-verifies Context readiness, Scope, Context, Evidence, and trust gates. If a changed Resync report exists, it also requires the matching fresh Skill Re-plan checkpoint. Successful Delivery records a fresh managed checkpoint.

## 14. Completion report

Report concrete state only: Task/branch, implementation summary, Classification, selected/resolved Skills, Context readiness/Scope blockers when relevant, handoff/Re-plan state, machine gates actually recorded, and delivery result or exact independent-review boundary still pending.
