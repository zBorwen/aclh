# Specification — Snapshot-bound Builder Self-Review

Task: `TASK-CODEX-ADAPTER-SELF-REVIEW`

## Background

The Codex Adapter told L1-L3 builders to run `self-review.ts` after machine Evidence, but the command only validated fields that `init-task.ts` left blank. Manually filling `.state.yaml` after Evidence made that Evidence stale, while an old filled record could later be reused after repository changes.

## Requirements

- Runtime must own the transition into the testing/self-review phase before final Context and Evidence.
- Builder self-review must be a separate semantic artifact rather than an inline mutation of `.state.yaml` after Evidence.
- The review must bind to the exact governed repository snapshot and become stale after a governed change.
- Writing review packet/record outputs must not invalidate canonical machine Evidence.
- Embedded and external Codex Adapter lifecycles must describe the same prepare/record/verify order.

## Acceptance Criteria

- [x] `self-review.ts <TASK_ID> --prepare` transitions an active task to `testing` and emits a packet.
- [x] Repeating `--prepare` in `testing` refreshes the packet without mutating governed task state.
- [x] `self-review.ts <TASK_ID> --verify` requires a complete `self-review.json` bound to the current repository snapshot.
- [x] A governed repository change makes the review stale.
- [x] Recording self-review after canonical Evidence leaves Evidence fresh.
- [x] Recording self-review after final Context leaves embedded Context fresh.
- [x] A complete external L2 consumer delivery passes without manually editing `.state.yaml`.

## Constraints

- Builder self-review remains distinct from Independent Review.
- Existing ACLH Evidence remains the only canonical machine PASS mechanism.
- No consumer Runtime implementation may be copied from the Engine.
