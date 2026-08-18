# ACLH Enforcement Model

ACLH distinguishes guidance from machine-enforced policy. Words such as **must**, **never**, and **forbidden** in prose do not by themselves make a rule enforceable.

## Levels

| Level | Meaning | Runtime behavior |
|---|---|---|
| `advisory` | Human/agent guidance that is not currently machine-verifiable. | No blocking effect. A reviewer may still reject violations. |
| `verifiable` | A machine or delegated tool can verify the rule, but ACLH does not currently treat failure as a merge/push blocker. | Report as warning/info; exit code remains 0 unless another blocking rule fails. |
| `blocking` | ACLH can verify the rule deterministically and the repository explicitly chooses to enforce it. | Failure produces a non-zero gate result and blocks the governed workflow. |

## Contract

1. Content under a plugin's `rules:` or workflow prose is **advisory by default** unless it is linked to executable verification.
2. Every executable plugin `checks:` entry MUST declare `enforcement: verifiable|blocking` explicitly. `advisory` rules should not be represented as executable checks.
3. `severity` controls presentation only; it does not decide whether a check blocks. `enforcement` is the authority for blocking behavior.
4. An `eslint-delegate` entry remains `verifiable` inside `check.ts` unless `check.ts` actually executes that delegated tool. A separate Evidence gate may still execute the canonical project command and enforce its result at the workflow level.
5. A rule may be promoted from `advisory` → `verifiable` → `blocking` only when its verification is deterministic enough to avoid unacceptable false positives.

## Direct blocking checks

The following rules are enforced directly by `check.ts`:

- Component file naming under `src/components/**/*.tsx` must be PascalCase.
- Hook file naming under `src/hooks/**/*.ts` must use the `useXxx` form.
- CSS file naming under `src/**/*.css` must be kebab-case.
- TypeScript source under `src/**/*.{ts,tsx}` must not contain `@ts-ignore`; use a documented `@ts-expect-error` when suppression is genuinely required.

These rules are direct `filename-pattern` or `grep-pattern` checks with low ambiguity.

## P1 evidence-backed blocking gates

The canonical workflow gates are:

- `npm run check`
- `npm run typecheck`
- `npm test`

They are blocking in two separate contexts.

### Local task delivery

`.harness/scripts/evidence.ts` executes the commands and records task-local evidence. A PASS remains valid only while the recorded `HEAD` SHA and worktree SHA-256 fingerprint match the current repository state. Any later content change makes the evidence stale and causes `--verify` to fail.

### GitHub Actions verification

`.harness/scripts/ci-evidence.ts` independently executes the same canonical commands inside GitHub Actions. It does not consume task-local evidence. Its result is bound to GitHub-provided provenance (`repository`, `GITHUB_SHA`, run identity, workflow, actor) and is uploaded as a workflow artifact.

This separation is intentional: local evidence is useful for fast Codex/pre-push feedback, while CI evidence is the independent server-side verification path.

A repository should configure the `Harness CI / verify` check as required in branch protection when it wants GitHub to prevent merging a failing PR. ACLH supplies the deterministic workflow and non-zero failure semantics; repository protection settings remain an administrative repository concern.

## Verifiable but non-blocking checks

- `@typescript-eslint/no-explicit-any` and unused-variable delegated rules.
- React Hooks ESLint delegated rules.
- PR hygiene scans for `console.log` and TODOs without a ticket.

These are not promoted merely because they are detectable. They still require either an executed canonical lint gate or clearer project policy before becoming blocking.

## Advisory rules

All other prose rules remain advisory: TDD sequencing, root-fix preference, architecture guidance, React design preferences, state-management recommendations, review-process statements, and similar natural-language constraints.

## Promotion rule

Do not add blocking checks merely because a rule sounds important. Promote only when all of the following are true:

1. the condition is objectively machine-detectable;
2. the Harness actually performs the verification;
3. the verification is bound to the code state it checked;
4. false positives are acceptably low;
5. failure has a clear remediation path;
6. the repository explicitly opts into blocking behavior.

## P1 completion boundary

P1 completes the execution-evidence layer: canonical gate execution, local freshness, evidence-backed blocking, and independent CI provenance. Static-analysis engine expansion, Semgrep, dependency/AST policy, semantic reviewer separation, signed attestations, dashboards, and knowledge retrieval are outside P1.
