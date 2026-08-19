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

## 3. Assess task metadata

Use Engine contracts, not a Classification-to-Skill lookup table.

- Classification primary: `feature | bug | refactor | migration | integration`.
- Assess risk from `$ACLH_RUNTIME_ROOT/.harness/governance.yaml`.
- Choose the dominant P2 compatibility verification strategy from Engine governance.
- Classification describes the overall Task; it does not select Engineering Skills.

## 4. Initialize consumer task state

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/init-task.ts" <TASK_ID> --risk <LEVEL> --strategy <STRATEGY>
```

Do not hand-create `.state.yaml` or `evidence.json`.

## 5. Persist and verify Classification

Create consumer `docs/wip/<TASK_ID>/classification.yaml`, then:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/classification.ts" <TASK_ID> --verify
```

## 6. Author the explicit Skill Plan

Inspect Engine `$ACLH_RUNTIME_ROOT/.harness/skills/*.yaml`. Create consumer `skill-plan.yaml` with explicit `selected` Skills only; do not write `resolved` manually.

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --resolve
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --verify
```

## 7. Generate Skill-aware Context

Project-specific Context state belongs to the consumer, including `.harness/project` and task `context.json`. Skill/context contracts remain Engine-owned.

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --generate
```

Read only the bounded selected Context required for implementation. Show one compact bootstrap summary, then continue unless a material ambiguity prevents safe work.

## 8. Implement and produce governed outputs

Implement the smallest safe solution in the consumer. Maintain task `spec.md`, `tasks.md`, `test-plan.md`, and `changelog.md`.

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/verification-plan.ts" <TASK_ID>
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-output.ts" <TASK_ID> --verify
```

Skill output structure is not semantic proof.

## 9. Refresh Context after content stabilizes

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --generate
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --verify
```

## 10. Record canonical machine Evidence

Determine the union of risk-required and verification-Skill-required gates using Engine governance/policy and consumer task state.

For each required gate:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --gate <check|typecheck|test>
```

External `check` executes the Engine checker against consumer source; `typecheck` and `test` execute the consumer's canonical npm scripts. Record only gates that truly ran.

Then verify:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --verify
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-evidence.ts" <TASK_ID> --verify
```

## 11. Review, managed handoff, and delivery boundary

When risk requires Builder self-review:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/self-review.ts" <TASK_ID>
```

For L2/L3 prepare Independent Review:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/independent-review.ts" <TASK_ID> --prepare
```

Before the Builder stops for a fresh reviewer, record the last state intentionally managed by ACLH:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/managed-snapshot.ts" <TASK_ID> --record
```

The managed snapshot is Git-local synchronization state, not Evidence and not a review PASS. The Builder context must not manufacture an independent PASS. Stop for a genuinely fresh Codex context or human reviewer. L3 remains human-only.

After the required independent review exists:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/delivery-gate.ts" <TASK_ID>
```

A successful Delivery Gate records a fresh managed checkpoint automatically.

## 12. Completion report

Report concrete state only: Task/branch, implementation summary, Classification, selected/resolved Skills, machine gates actually recorded, and delivery result or exact independent-review boundary still pending.
