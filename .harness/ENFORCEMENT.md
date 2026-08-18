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

## P0 minimal blocking baseline

P0 intentionally keeps the blocking set small. A rule is blocking only when ACLH can determine the result directly without relying on semantic interpretation or an external tool that is not yet executed by the Harness.

### Blocking now

- Component file naming under `src/components/**/*.tsx` must be PascalCase.
- Hook file naming under `src/hooks/**/*.ts` must use the `useXxx` form.
- CSS file naming under `src/**/*.css` must be kebab-case.
- TypeScript source under `src/**/*.{ts,tsx}` must not contain `@ts-ignore`; use a documented `@ts-expect-error` when suppression is genuinely required.

These rules are direct `filename-pattern` or `grep-pattern` checks executed by `check.ts` and have low ambiguity.

### Verifiable now

- TypeScript compiler verification (`tsc --noEmit`).
- `@typescript-eslint/no-explicit-any` and unused-variable checks.
- React Hooks ESLint rules.
- PR hygiene scans for `console.log` and TODOs without a ticket.

These remain non-blocking in P0 because ACLH either delegates them to an external tool or they can reasonably require project-specific policy. They are candidates for P1 evidence-backed promotion.

### Advisory now

All other prose rules: TDD sequencing, root-fix preference, architecture guidance, React design preferences, state-management recommendations, review-process statements, and similar natural-language constraints.

## Promotion rule

Do not add blocking checks merely because a rule sounds important. Promote only when all of the following are true:

1. the condition is objectively machine-detectable;
2. the Harness actually performs the verification;
3. false positives are acceptably low;
4. failure has a clear remediation path;
5. the repository explicitly opts into blocking behavior.

P1 should add command evidence and then reconsider promotion of typecheck, lint, tests, dependency boundaries, and other objective gates.
