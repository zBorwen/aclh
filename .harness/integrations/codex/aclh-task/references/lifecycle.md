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

If required capabilities changed, edit explicit `selected`, then:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --resolve
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --verify
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-replan.ts" <TASK_ID> --record changed --source codex
```

Always verify the handoff checkpoint:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-replan.ts" <TASK_ID> --verify
```

Runtime validates the explicit re-plan decision but never chooses Skills automatically.

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

For a continuing Task, verify the existing Classification rather than rewriting it from the latest feedback subtype.

## 7. Author or verify the explicit Skill Plan

Inspect Engine `$ACLH_RUNTIME_ROOT/.harness/skills/*.yaml`. For a new Task, create `skill-plan.yaml` with explicit `selected` Skills only; do not write `resolved` manually.

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --resolve
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-plan.ts" <TASK_ID> --verify
```

A continuing changed Task must already have completed the Re-plan checkpoint from step 3.

## 8. Resolve Context readiness and bootstrap blockers

First inspect readiness without hiding blockers:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-readiness.ts" <TASK_ID> --json
```

Readiness states are `ready`, `missing`, and `present-but-unusable`. Required non-ready sources block Context; optional unavailable sources do not block.

If required blockers exist, prepare a deterministic bootstrap plan:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-bootstrap.ts" <TASK_ID> --prepare --json
```

Bootstrap has a strict ownership boundary:

- For missing required knowledge ledgers, Runtime may safely initialize `entries: []`.
- For semantic project Context such as `profile.yaml` or `architecture.yaml`, Runtime must not invent or overwrite content. Inspect the consumer repository and author the smallest factual project Context needed by the capability.
- If an existing knowledge source is malformed/unusable, do not overwrite it automatically; repair it explicitly.

After bootstrap/authoring work, require Runtime validation:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-readiness.ts" <TASK_ID> --verify --json
```

An empty schema-valid knowledge ledger is ready; an empty semantic profile/architecture template is not.

## 9. Generate and verify Context Scope

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-scope.ts" <TASK_ID> --generate
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-scope.ts" <TASK_ID> --verify
```

Scope combines business changed files with explicit task scope, maps files to project architecture modules, and expands dependencies exactly one hop from the frozen seed set. Context must consume resolved Scope rather than silently widening it.

## 10. Generate or refresh Skill-aware Context

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --generate
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/context-select.ts" <TASK_ID> --verify
```

Knowledge retrieval is bounded by Scope relevance before ranking. Severity may boost a relevant item but must never admit an unrelated item by itself. Read only the bounded selected Context.

## 11. Implement and produce governed outputs

Implement the smallest safe solution in the consumer. Maintain `spec.md`, `tasks.md`, `test-plan.md`, and `changelog.md`.

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/verification-plan.ts" <TASK_ID>
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-output.ts" <TASK_ID> --verify
```

Skill output structure is not semantic proof. After code/task content stabilizes, rerun readiness when project Context changed, then regenerate/verify Scope and Context before final verification planning.

When risk requires Builder self-review, prepare its Runtime-owned phase transition before the final Context, Gap Registry, browser proof, and Evidence pass:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/self-review.ts" <TASK_ID> --prepare
```

This creates `self-review-packet.md` and moves an active task to `testing`; it does not create a review PASS. Rerun the final readiness/Scope/Context verification after this state transition.

## 12. Finalize the Verification Gap Registry

Before recording machine Evidence, inspect verification dimensions that canonical `check/typecheck/test` do not automatically prove, such as browser interaction, visual layout, runtime integration, accessibility, performance behavior, or architecture boundaries when relevant to the Task.

Create consumer `docs/wip/<TASK_ID>/verification-gaps.yaml`:

- v1.0 remains valid for canonical machine gates only.
- v1.1 may additionally use `machine_proofs: [browser]`.

Coverage entries use one of:

- `machine-covered`: declare one or more canonical `machine_gates`, supported `machine_proofs`, or both.
- `human-covered`: include a real human coverage record with `source: human`, checker identity, timestamp, concrete procedure, and observed result. Builder Codex must never manufacture human provenance.
- `uncovered`: record the remaining gap and why it is uncovered. Any uncovered entry blocks completion.

Before machine verification, validate/finalize the registry structurally:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/verification-gaps.ts" <TASK_ID> --check
```

The registry is governed task state and is intentionally included in the final canonical Evidence repository fingerprint. Do not edit it after machine verification without rerunning stale proofs/Evidence.

If required human coverage is not yet available, stop at that human-verification boundary rather than fabricating it.

## 13. Run declared browser verification when required

If any machine-covered registry entry declares:

```yaml
machine_proofs:
  - browser
```

then the consumer must already provide a real `package.json` script named `test:browser`. ACLH Engine does not install Playwright, Cypress, browsers, or other test dependencies into the consumer.

Run the consumer-owned browser verifier:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/browser-verification.ts" <TASK_ID> --run
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/browser-verification.ts" <TASK_ID> --verify
```

The proof binds the exact `test:browser` script and consumer repository snapshot. A failing script or any governed repository mutation while it runs records FAIL. The browser proof excludes only its own output and later Evidence/Review outputs from its freshness calculation.

If `test:browser` is missing, browser machine coverage is unavailable. Do not install a framework automatically and do not claim browser coverage. Use real human coverage when appropriate or leave the gap uncovered so delivery blocks.

`browser-verification.json` remains governed Task state for canonical Evidence: do not edit or rerun it after final Evidence without refreshing stale Evidence.

## 14. Record canonical machine Evidence

Determine the union of risk-required, verification-Skill-required, and registry `machine_gates`. Record the canonical gates that are actually required:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --gate <check|typecheck|test>
```

External `check` executes the Engine checker against consumer source; `typecheck` and `test` execute consumer canonical npm scripts. Record only gates that truly ran.

Then verify Evidence and all registry machine coverage:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/evidence.ts" <TASK_ID> --verify
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/skill-evidence.ts" <TASK_ID> --verify
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/verification-gaps.ts" <TASK_ID> --verify
```

The Gap Registry does not create a second PASS. Canonical machine coverage consumes canonical Evidence; browser machine coverage consumes the fresh browser proof.

## 15. Review, managed handoff, and delivery boundary

When risk requires Builder self-review:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/self-review.ts" <TASK_ID> --prepare
```

The second prepare is idempotent and refreshes the packet to the final post-Evidence snapshot without changing task state. Answer every packet question in consumer `docs/wip/<TASK_ID>/self-review.json`, copy its exact repository snapshot, then verify:

```bash
ACLH_PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/self-review.ts" <TASK_ID> --verify
```

`self-review.json` is excluded from machine Evidence freshness, but its own repository binding becomes stale after any governed consumer change.

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

Delivery re-verifies Context readiness, Scope, Context, Verification Gap coverage, Evidence, browser proof when declared, and trust gates. If a changed Resync report exists, it also requires the matching fresh Skill Re-plan checkpoint. Successful Delivery records a fresh managed checkpoint.

## 16. Completion report

Report concrete state only: Task/branch, implementation summary, Classification, selected/resolved Skills, Context bootstrap/readiness/Scope state, Verification Gap coverage, browser proof state when applicable, handoff/Re-plan state, machine gates actually recorded, and delivery result or exact human/independent-review boundary still pending.
