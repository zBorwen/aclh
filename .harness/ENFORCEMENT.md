# ACLH Enforcement Model

ACLH distinguishes guidance from machine-enforced policy. Words such as **must**, **never**, and **forbidden** in prose do not by themselves make a rule enforceable.

## Levels

| Level | Meaning | Runtime behavior |
|---|---|---|
| `advisory` | Human/agent guidance that is not currently machine-verifiable. | No blocking effect. A reviewer may still reject violations. |
| `verifiable` | A machine or delegated tool can verify the rule, but ACLH does not currently treat failure as a merge/push blocker. | Report as warning/info; exit code remains 0 unless another blocking rule fails. |
| `blocking` | ACLH can verify the rule deterministically and the repository explicitly chooses to enforce it. | Any violation makes `check.ts` exit non-zero. |

## Contract

1. Content under a plugin's `rules:` or workflow prose is **advisory by default** unless it is linked to an executable `checks:` entry.
2. Every executable `checks:` entry MUST declare `enforcement: verifiable|blocking` explicitly. `advisory` rules should not be represented as executable checks.
3. `severity` controls presentation only; it does not decide whether the command fails. `enforcement` is the authority for blocking behavior.
4. `eslint-delegate` is `verifiable` until ACLH actually executes the delegated command/rule and captures its result. Merely printing an instruction is not enforcement.
5. A rule may be promoted from `advisory` → `verifiable` → `blocking` only when its verification is deterministic enough to avoid unacceptable false positives.

## Current baseline

### Blocking now

- Component file naming under `src/components/**/*.tsx`.
- Hook file naming under `src/hooks/**/*.ts`.
- CSS file naming under `src/**/*.css`.

These are direct, deterministic `filename-pattern` checks executed by `check.ts`.

### Verifiable now

- ESLint/TypeScript delegated rules in `react-patterns` and `typescript-strict`.
- PR hygiene scans for `console.log` and TODOs without a ticket.

These are visible to the machine, but are deliberately non-blocking at this P0 stage. Delegated checks must not be called blocking until their external tool result is actually executed and captured.

### Advisory now

All other prose rules: TDD sequencing, root-fix preference, architecture guidance, React design preferences, state-management recommendations, review-process statements, and similar natural-language constraints.

The next promotion step should focus on rules with objective evidence: typecheck/lint/test commands, dependency boundaries, changed-file scope, required task artifacts, and acceptance-criteria/test mapping.
