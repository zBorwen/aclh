---
name: aclh-task
description: Use an attached external ACLH Engine to understand, classify, implement, verify, review, and deliver a repository engineering task. Invoke explicitly with $aclh-task.
---

# ACLH External Task Adapter

This is a thin consumer integration. It contains orchestration instructions only; ACLH Runtime implementation remains outside the consumer repository.

## Resolve the Engine

1. Treat the current Git repository root as `PROJECT_ROOT`.
2. Resolve `ACLH_RUNTIME_ROOT` from the environment. If it is missing, stop and report that the ACLH Engine is not attached for this shell/session.
3. Read `$ACLH_RUNTIME_ROOT/.harness/external-capabilities.yaml` before invoking Runtime.
4. Read `references/lifecycle.md` and follow it in order.
5. Never copy Engine scripts, Skill contracts, policies, registries, or templates into the consumer repository.

## Runtime ownership

For Runtime transitions, call Engine-owned scripts with `ACLH_PROJECT_ROOT="$PROJECT_ROOT"`. Runtime contracts/policies come from `ACLH_RUNTIME_ROOT`; consumer Git state, project Context, task artifacts, Evidence, and review artifacts belong to `PROJECT_ROOT`.

If any required command is marked `pending` in the capability manifest, stop at that exact boundary rather than silently falling back to embedded Runtime behavior.

Classification describes the overall Task. Explicit Engineering Skill selection remains separate from Classification. Builder self-review never substitutes for a required independent review, and the Builder must not manufacture an independent PASS.
