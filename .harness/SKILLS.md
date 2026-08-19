# ACLH Engineering Skills — P3 Contract

P3 introduces Engineering Skills as reusable engineering capabilities. It does **not** turn ACLH into a prompt library or replace the P0-P2 governance/trust runtime.

## Core model

```text
Task
  -> Classification
  -> explicit Skill Plan
  -> Skill Contracts
  -> Context Requirements
  -> Context Runtime
  -> Builder
  -> Governance / Evidence / Review
```

The workflow is a resolved result of the task's Skill Plan. Workflow is not the primary reusable unit.

## Terms

### Problem Classification
Describes what kind of engineering problem the task represents. Classification describes the task; it does not select skills and does not determine delivery depth.

### Skill
A reusable engineering capability with declared inputs, outputs, dependencies and completion invariants.

A Skill is **not**:
- a free-form prompt;
- a complete task workflow;
- a risk policy;
- a delivery gate;
- a reviewer or verifier identity;
- the Context Resolver;
- machine evidence or CI provenance.

### Skill Contract
The repository-owned, machine-validatable declaration of one Skill. Contract v1 answers:
1. identity — which capability is this;
2. kind — understanding or verification;
3. context requirements — what information it needs;
4. skill dependencies — which capabilities must precede it;
5. outputs — which artifacts/facts it produces;
6. completion invariants — what must be true for the capability to be considered complete.

### Skill Plan
A task-local declaration of selected Skills plus the deterministic dependency-resolved set. P3 v1 keeps selection explicit. Automatic AI recommendation versus rule-based mapping is intentionally deferred until the explicit model has real usage evidence.

### Context Runtime
Resolves Context capabilities requested by the Skill Plan, deduplicates requirements, applies bounded retrieval/freshness rules, and records why each Context item was loaded. Context Runtime is infrastructure, not a Skill.

### Governance Runtime
P0/P2 enforcement, risk, policy and delivery depth. Problem type decides what engineering capabilities are needed; risk decides how strictly the work is governed.

### Trust Runtime
P1 machine evidence, repository freshness, CI provenance, Builder self-review and Independent Review. A Skill may require evidence, but it cannot manufacture its own trusted PASS state.

## P3 v1 boundaries

P3 v1 supports two Skill kinds:
- `understanding`
- `verification`

Execution Skills are deferred. The Builder continues to own implementation while Skills structure understanding and verification around that implementation.

P3 v1 intentionally does not add:
- AI-driven automatic Skill recommendation;
- deterministic Classification-to-Skill mapping;
- remote Skill registries/marketplaces;
- plugin code loading;
- semantic version resolution;
- model/provider-specific Skill implementations.

These decisions require evidence from the explicit Skill Plan model first.

## Compatibility principle

P3 extends P0-P2 rather than replacing them:
- P0 remains the enforcement foundation.
- P1 remains the trust/evidence foundation.
- P2 remains the risk, task-identity and bounded-context foundation.
- P3 adds task classification and composable Engineering Skills.

No Skill-level status may bypass existing Evidence or Review requirements.
