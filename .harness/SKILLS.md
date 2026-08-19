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
  -> Skill Outputs
  -> Governance / Evidence / Review
```

The workflow is a resolved result of the task's Skill Plan. Workflow is not the primary reusable unit.

## Terms

### Problem Classification
Describes what kind of engineering problem the task represents. Classification describes the task; it does not select Skills and does not determine delivery depth.

Classification v1 has a closed primary vocabulary:
- `feature`
- `bug`
- `refactor`
- `migration`
- `integration`

Traits add orthogonal engineering properties without exploding the primary taxonomy. Confidence is `high|medium|low`, not a pseudo-probability. Source records whether the classification came from Codex, a human, or a human override.

### Skill
A reusable engineering capability with declared inputs, outputs, dependencies and completion invariants.

A Skill is **not**:
- a free-form prompt;
- a complete task workflow;
- a risk policy;
- a delivery gate;
- a reviewer or verifier identity;
- the Context Resolver;
- machine Evidence or CI provenance.

### Skill Contract
The repository-owned, machine-validatable declaration of one Skill. Contract v1 answers:
1. identity — which capability is this;
2. kind — understanding or verification;
3. context requirements — what information it needs;
4. skill dependencies — which capabilities must precede it;
5. outputs — which artifacts/facts it produces;
6. completion invariants — what must be true for the capability to be considered complete.

Contracts live in `.harness/skills/*.yaml` and are validated through the shared Skill Runtime. A Contract cannot declare arbitrary Context names: every Context requirement must exist in `.harness/context/capabilities.yaml`.

### Skill Plan
A task-local `skill-plan.yaml` containing:
- `selected`: explicit Skill choices authored by Codex/human;
- `resolved`: deterministic dependency-first expansion produced by the Runtime.

P3 v1 deliberately does **not** auto-create Skill Plans from Classification. Automatic AI recommendation versus deterministic mapping remains deferred until the explicit model has real usage evidence.

### Context Runtime
Resolves Context capabilities requested by all resolved Skills, deduplicates requirements, applies bounded retrieval and records why each capability was loaded.

P3 `context.json` v2 freshness binds:
- repository change content;
- explicit context scope;
- Skill Plan;
- Skill Context contracts/capability definitions;
- retrieval policy.

Changing any of these invalidates the old P3 Context. Legacy P2 tasks without a Skill Plan retain the P2 `context.json` v1.1 path.

### Skill Outputs
Understanding and verification Skills produce task-local artifacts. `.harness/artifacts/skill-outputs.yaml` defines machine-checkable file/section structure. Structural completion is not semantic proof: natural-language completion invariants remain review obligations.

### Governance Runtime
P0/P2 enforcement, risk, task identity and delivery depth. Risk is orthogonal to Skill selection: it determines how strictly the work is governed, not which engineering problem the task represents.

### Trust Runtime
P1 machine Evidence, repository freshness, CI provenance, Builder self-review and Independent Review.

Verification Skills map through `.harness/policies/skill-evidence.yaml` to existing canonical P1 gates (`check`, `typecheck`, `test`). They do not create a second Skill-level PASS format. A fresh Skill output without fresh required machine Evidence is not a trusted verification result.

## P3 v1 Skill catalog

Understanding:
- `task-decomposition`
- `root-cause-analysis`
- `change-impact-analysis`

Verification:
- `regression-verification`
- `compatibility-verification`

Execution Skills are deferred. The Builder continues to own implementation while Skills structure understanding and verification around that implementation.

## Runtime layout

```text
.harness/
  skills/                 # reusable Skill Contracts
  context/
    capabilities.yaml     # Context capability vocabulary/resolver registry
  artifacts/
    skill-outputs.yaml    # Skill output artifact contracts
  policies/
    skill-evidence.yaml   # verification Skill -> canonical Evidence gates
  scripts/
    lib/                   # shared deterministic contract/runtime logic
    classification.ts
    skill-check.ts
    skill-resolve.ts
    skill-plan.ts
    context-select.ts
    skill-output.ts
    skill-evidence.ts
    delivery-gate.ts
```

Existing `.harness/plugins`, `.harness/project`, `.harness/hooks` and P0-P2 scripts remain in place. P3 does not perform a cosmetic repository-wide path migration.

## P3 delivery semantics

For tasks with `skill-plan.yaml`:

```text
task identity
  -> Classification
  -> resolved Skill Plan
  -> Skill-aware Context
  -> P2 verification-strategy compatibility markers
  -> Skill output contracts
  -> risk-required P1 Evidence
  -> verification-Skill P1 Evidence
  -> Builder self-review when required by risk
  -> Independent Review when required by risk
```

Skill-required Context is an execution prerequisite for P3 tasks even at L0. Legacy P2 L0 tasks without `skill-plan.yaml` retain optional Context behavior.

## P3.10 compatibility decision

P2 `verification_strategy` is **retained** in P3 v1. The current five-Skill catalog does not yet fully express component/config/docs/rollback verification semantics, so removing the P2 strategy now would discard validated behavior rather than simplify the model.

It remains a compatibility layer and can be reconsidered only after future Skill coverage proves it redundant.

## Explicit P3 v1 non-goals

P3 v1 intentionally does not add:
- AI-driven automatic Skill recommendation;
- deterministic Classification-to-Skill mapping;
- execution Skills;
- remote Skill registries/marketplaces;
- plugin code loading;
- semantic version resolution;
- model/provider-specific Skill implementations;
- semantic/vector Context retrieval;
- a Skill-owned trusted PASS mechanism.

## Compatibility principle

P3 extends P0-P2 rather than replacing them:
- P0 remains the enforcement foundation.
- P1 remains the trust/evidence foundation.
- P2 remains the risk, task-identity and bounded-context foundation.
- P3 adds task classification and composable Engineering Skills.

No Skill-level artifact or declaration may bypass existing Evidence or Review requirements.
