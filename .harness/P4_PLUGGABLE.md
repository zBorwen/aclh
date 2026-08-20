# P4 — Pluggable Runtime & Adaptive Task Lifecycle

P4 starts from a boundary discovered through real Adapter testing: ACLH must govern a consumer project without becoming that project.

## Frozen principles

1. **Engine outside, state inside.** ACLH Runtime code, policies, Engineering Skill contracts, registries, and templates belong to the ACLH Engine. Task state and project-specific context belong to the consumer repository.
2. **ACLH owns governance state, not the project.** Consumer source, build configuration, dependencies, and application structure remain ordinary project concerns.
3. **Plug/unplug must be architectural, not prompt-based.** Isolation must not depend on telling Codex not to edit ACLH files. The Engine implementation is outside the consumer development surface.
4. **Legacy in-repo mode stays compatible while the boundary is introduced.** When runtime root and project root are the same directory, existing P0–P3 behavior must remain unchanged.
5. **Human and AI work may alternate.** Later P4 stages will resynchronize governance after out-of-band human changes rather than requiring every small edit to enter through `$aclh-task`.

## Root model

- `runtimeRoot`: location of the ACLH Engine checkout/install.
- `projectRoot`: Git repository being governed.
- Runtime-owned inputs are resolved from `runtimeRoot`: `.harness/governance.yaml`, `.harness/skills`, `.harness/context`, `.harness/plugins`, Runtime scripts, and templates.
- Project-owned state is resolved from `projectRoot`: Git identity/change set, `docs/wip`, project context, task artifacts, Evidence, and review artifacts.

The default is `runtimeRoot === projectRoot` for backward compatibility. External consumers set `ACLH_PROJECT_ROOT` while invoking scripts from the Engine.

## P4.0–P4.4 acceptance boundary

The first P4 slice is complete only when:

1. Runtime and project roots are explicit in executable code.
2. A temporary independent Git consumer fixture can initialize and validate an ACLH task using the Engine checkout without copying Engine implementation into the consumer repository.
3. The repo-local Codex Adapter is thin and can invoke the external Engine against the current consumer repository.
4. Two independent consumer repositories can use the same Engine checkout.
5. Removing the thin integration does not affect the consumer application's ability to build/run on its own.

## Not in this slice

Human handoff/resync, Skill re-planning, Context Scope v1, Context source readiness/bootstrap, browser verification, package registry/distribution, implicit `$aclh` routing, automatic commit/push, and deletion of the P2 verification-strategy compatibility layer are intentionally deferred.
