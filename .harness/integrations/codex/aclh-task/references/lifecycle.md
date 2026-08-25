# ACLH External Task Lifecycle

`PROJECT_ROOT` is the consumer Git repository. Runtime remains under
`ACLH_RUNTIME_ROOT`; never copy Engine scripts/contracts into the consumer.
Run Runtime commands with both roots bound:

```bash
export ACLH_PROJECT_ROOT="$PROJECT_ROOT"
```

Runtime commands below use:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/<script>.ts" ...
```

## 1. Compact bootstrap

Understand the goal, observable behavior, boundaries and material ambiguities.
Read consumer `AGENTS.md` when present. Do not read Engine `AGENTS.md`, governance
source, Skill source or Runtime scripts to discover routine choices. Load the
bounded contract once:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/task-contract.ts" --json
```

Use it to assess Classification, risk, one P2 strategy and the minimal explicit
Skills. Classification does not mechanically select Skills.

Inspect consumer Git status, branch and HEAD. A new task requires a clean,
dedicated `agent/<task-slug>` branch. Continue an existing task only when its
`.state.yaml` binds the current branch. Preserve unrelated human work.

## 2. New task

Derive a unique `TASK-...` ID unless the user supplied one. Initialize, author the
Classification and explicit `selected` Skills, then validate:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/init-task.ts" <TASK_ID> --risk <LEVEL> --strategy <STRATEGY>
node "$ACLH_RUNTIME_ROOT/.harness/scripts/classification.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --resolve
node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-readiness.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-scope.ts" <TASK_ID> --generate
node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --generate
```

Do not write `resolved` manually. If Context Readiness reports genuinely missing
consumer project knowledge, author only the required consumer knowledge artifact,
verify readiness and retry Context. Show one compact bootstrap summary and
continue unless a material ambiguity blocks safe implementation.

## 3. Continuing task / human handoff

Check the Git-local managed state:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/managed-snapshot.ts" <TASK_ID> --status --json
```

For `clean`, continue. For `unknown`, do not invent history. For `changed`, run:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/resync.ts" <TASK_ID> --prepare --json
```

Preserve Classification. Reconsider explicit Skills. Record either an unchanged or
changed Skill decision with `skill-replan.ts`, verify it, then refresh only the
artifacts listed by Resync.

## 4. Build and verify

Implement the smallest root fix. Maintain required task docs, P2 markers and
selected Skill outputs:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/verification-plan.ts" <TASK_ID>
node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-output.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/self-review.ts" <TASK_ID> --prepare
```

After governed content stabilizes, refresh Scope/Context once. Complete the
verification-gap registry required by external mode, including canonical browser
proof when browser interaction is claimed. Record only policy-required canonical
gates:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-scope.ts" <TASK_ID> --generate
node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --generate
node "$ACLH_RUNTIME_ROOT/.harness/scripts/browser-verification.ts" <TASK_ID> --run
node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --gate check
node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --gate typecheck
node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --gate test
node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-evidence.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/verification-gaps.ts" <TASK_ID> --verify
```

Run only required gates/proofs. Never claim unrecorded verification.

## 5. Builder self-review

Refresh the packet against the final post-Evidence snapshot, write
`self-review.json`, answer every hostile question, and verify:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/self-review.ts" <TASK_ID> --prepare
node "$ACLH_RUNTIME_ROOT/.harness/scripts/self-review.ts" <TASK_ID> --verify
```

## 6. Independent review boundary

Prepare, then run the mandatory read-only dispatch preflight:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/independent-review.ts" <TASK_ID> --prepare
node "$ACLH_RUNTIME_ROOT/.harness/scripts/task-status.ts" <TASK_ID> --review-ready --json
```

Dispatch a fresh Codex context/human only when the second command exits zero with
`review_ready: true`.

- Builder owns product/task files, Context, Evidence and `self-review.json`.
- Reviewer may write only `independent-review.json`.
- Reviewer must not repair stale Builder state or run Delivery Gate.
- Builder must not create an independent PASS. L3 requires a human.

After a separate review exists:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/independent-review.ts" <TASK_ID> --verify
node "$ACLH_RUNTIME_ROOT/.harness/scripts/delivery-gate.ts" <TASK_ID>
```

On REJECT, add regression coverage when feasible, repair as Builder, refresh
Builder-owned artifacts, prepare a new packet and preflight again.

## 7. Continuation and reporting

At every continuation boundary use one bounded status call:

```bash
node "$ACLH_RUNTIME_ROOT/.harness/scripts/task-status.ts" <TASK_ID> --json
```

Follow `next_action`; inspect only failed artifacts. Do not repeatedly dump all
PASS output or Runtime implementation. Report concrete implementation,
verification and the exact remaining review/delivery boundary.
