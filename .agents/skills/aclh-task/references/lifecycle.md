# ACLH Task Adapter Lifecycle

Runtime scripts are authoritative. Use this reference for semantic decisions and
role boundaries; use `task-status.ts` for current machine state. Do not inspect
Runtime source merely to infer the next lifecycle command.

## 1. Bootstrap

Understand the goal, observable behavior, boundaries and material ambiguities.
Reuse a supplied task ID or derive a unique `TASK-...` ID.

Before mutation, inspect Git status, branch and HEAD. New tasks require a clean,
dedicated `agent/<task-slug>` branch. A continuation may reuse a branch only when
the existing `.state.yaml` binds that task to it. Never discard unrelated changes.

Assess from the request and repository:

- Classification primary/traits/confidence/rationale;
- risk `L0|L1|L2|L3` from blast radius;
- one P2 compatibility strategy;
- the minimal explicit Engineering Skills actually needed.

Classification must not mechanically select Skills. In an external consumer, load
the bounded contract instead of reading Engine governance/source files:

```bash
node .harness/scripts/task-contract.ts --json
```

Select only relevant Skills from that result. Then initialize and validate:

```bash
node .harness/scripts/init-task.ts <TASK_ID> --risk <LEVEL> --strategy <STRATEGY>
node .harness/scripts/classification.ts <TASK_ID> --verify
node .harness/scripts/skill-plan.ts <TASK_ID> --resolve
node .harness/scripts/skill-plan.ts <TASK_ID> --verify
node .harness/scripts/context-select.ts <TASK_ID> --generate
node .harness/scripts/context-select.ts <TASK_ID> --verify
```

Create `classification.yaml` and the explicit `selected` list in
`skill-plan.yaml`. Do not write `resolved` manually. Runtime owns dependency
ordering. Show one compact bootstrap summary, then continue unless an ambiguity
materially changes the solution.

## 2. Build and verify

Implement the smallest root fix. Maintain the task's required spec, task, test and
changelog artifacts. Complete P2 markers and selected Skill outputs:

```bash
node .harness/scripts/verification-plan.ts <TASK_ID>
node .harness/scripts/skill-output.ts <TASK_ID> --verify
```

Before final verification, prepare Builder review state:

```bash
node .harness/scripts/self-review.ts <TASK_ID> --prepare
```

After governed implementation/task content stabilizes, regenerate and verify
Context. Then record only the union of risk- and Skill-required gates:

```bash
node .harness/scripts/context-select.ts <TASK_ID> --generate
node .harness/scripts/context-select.ts <TASK_ID> --verify
npm run evidence -- <TASK_ID> --gate check
npm run evidence -- <TASK_ID> --gate typecheck
npm run evidence -- <TASK_ID> --gate test
npm run evidence -- <TASK_ID> --verify
node .harness/scripts/skill-evidence.ts <TASK_ID> --verify
```

Do not run gates the policy does not require. If governed content changes, use
Runtime status to identify what became stale; regenerate and verify Context and
Evidence instead of rereading the entire lifecycle.

## 3. Builder self-review

Refresh the packet against the final post-Evidence repository snapshot:

```bash
node .harness/scripts/self-review.ts <TASK_ID> --prepare
node .harness/scripts/self-review.ts <TASK_ID> --verify
```

The Builder writes `self-review.json` and answers every packet question. Review
packet/record outputs do not stale machine Evidence, but governed source/task
changes do stale the review.

## 4. Independent review boundary

Prepare the packet, then ask Runtime whether dispatch is legal:

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --prepare
node .harness/scripts/task-status.ts <TASK_ID> --review-ready --json
```

Dispatch a fresh Codex context or human only when that command exits zero and
returns `review_ready: true`.

Role contract:

- Builder owns product code, task artifacts, Context, Evidence and
  `self-review.json`.
- Reviewer may write only `independent-review.json`.
- Reviewer must not modify product code, refresh Context/Evidence, rewrite Builder
  review artifacts or run a mutating delivery command.
- A stale/missing prerequisite is returned to the Builder. The reviewer must not
  repair it.
- The Builder context must not create an independent PASS. L3 requires a human.

After the separate reviewer records a result, verify and deliver:

```bash
node .harness/scripts/independent-review.ts <TASK_ID> --verify
node .harness/scripts/delivery-gate.ts <TASK_ID>
```

On REJECT, record feedback, add an appropriate regression first when feasible,
repair as Builder, refresh Builder-owned artifacts, prepare a new packet and run
the review-readiness preflight again.

## 5. Compact status and reporting

At any continuation boundary run:

```bash
node .harness/scripts/task-status.ts <TASK_ID> --json
```

Follow `next_action` and inspect only failed artifacts. Do not repeatedly dump all
PASS output or the Engine implementation. Report task/branch, classification,
risk/strategy, selected Skills, actual verification, and the exact remaining
boundary.
