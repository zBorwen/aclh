---
name: aclh-task
description: Use an attached external ACLH Engine to govern a repository task. Invoke explicitly with $aclh-task while the external lifecycle is being rolled out.
---

# ACLH External Task Adapter

This is a thin consumer integration. It does not contain ACLH Runtime implementation.

## Resolve the Engine

1. Treat the current Git repository root as `PROJECT_ROOT`.
2. Resolve `ACLH_RUNTIME_ROOT` from the environment. If it is missing, stop and report that the ACLH Engine is not attached for this shell/session.
3. Read `$ACLH_RUNTIME_ROOT/.harness/external-capabilities.yaml` before invoking any Runtime command.
4. Never copy `.harness/scripts`, `.harness/skills`, policies, registries, or templates into the consumer repository to work around a pending capability.

## Invocation contract

For every supported external command, run the Engine-owned script with the consumer project explicitly bound:

```bash
AC..._PROJECT_ROOT="$PROJECT_ROOT" node "$ACLH_RUNTIME_ROOT/.harness/scripts/<script>.ts" ...
```

Use the real environment variable name `ACLH_PROJECT_ROOT` in commands; the shortened form above is explanatory only.

Runtime-owned inputs come from `ACLH_RUNTIME_ROOT`. Task state and Git operations belong to `PROJECT_ROOT`.

## Current rollout rule

Only commands marked `supported` in `.harness/external-capabilities.yaml` may run in external mode. If the next required lifecycle command is `pending`, stop at that boundary and report the exact pending capability. Do not silently fall back to an embedded `.harness` copy.

Classification still describes the overall task. Explicit Engineering Skill selection remains separate from Classification and must use only Engine-provided Skill contracts.

The Builder must not manufacture Evidence, review, or delivery PASS states while those external capabilities remain pending.
