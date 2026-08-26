# ACLH Evidence & Review Trust Model v1.3

P1 separates objective machine evidence from semantic review. A claim is not considered independently reviewed merely because the builder answered its own checklist.

## 1. Machine evidence

Three canonical gates are required:

| Gate | Canonical command | Local pre-push | CI verifier |
|---|---|---:|---:|
| `check` | `npm run check` | required | required |
| `typecheck` | `npm run typecheck` | required | required |
| `test` | `npm test` | required | required |

Local task evidence lives at `docs/wip/<TASK_ID>/evidence.json` (schema 1.1). Every PASS is bound to the current `commit_sha` plus a `worktree_sha256` fingerprint. Repository changes make prior evidence stale.

GitHub Actions independently reruns the canonical gates through `.harness/scripts/ci-evidence.ts`. It does not trust local evidence and uploads `.harness/artifacts/ci-evidence.json` with GitHub-provided repository/run provenance.

## 2. Builder self-review

`.harness/scripts/self-review.ts` remains an optional adversarial checklist for the builder. It is **not independent evidence**, does not satisfy the independent-review gate, and is not a default Delivery prerequisite.

## 3. Independent semantic review

P1 requires a second review context before task delivery:

```bash
node .harness/scripts/independent-review.ts JIRA-101 --prepare
```

This creates `docs/wip/JIRA-101/review-packet.md` containing the task artifacts and exact repository snapshot. The packet must be reviewed either by:

- a **fresh Codex context** that did not build the change; or
- a human reviewer.

The reviewer records `docs/wip/JIRA-101/independent-review.json` with schema 1.1:

```json
{
  "version": "1.1",
  "task_id": "JIRA-101",
  "builder": { "session_id": "builder-session" },
  "reviewer": { "kind": "codex-fresh-context", "session_id": "review-session" },
  "repository": {
    "commit_sha": "0123456789abcdef...",
    "worktree_sha256": "..."
  },
  "reviewed_at": "2026-08-19T00:00:00.000Z",
  "verdict": "READY_WITH_FINDINGS",
  "findings": [{
    "id": "EDGE-1",
    "category": "edge-case",
    "severity": "minor",
    "summary": "A non-blocking boundary is not covered.",
    "evidence": "The test matrix has no corresponding scenario.",
    "recommendation": "Consider adding coverage if this boundary matters."
  }],
  "notes": "Acceptance criteria, regressions, root cause and tests reviewed."
}
```

Then run:

```bash
node .harness/scripts/independent-review.ts JIRA-101 --verify
```

Verification blocks when the record is missing, stale, malformed, uses an unsupported reviewer kind, declares the same builder/reviewer session id, or has an inconsistent verdict/finding structure. `READY_WITH_FINDINGS` and `NOT_READY` are valid completed Reviews; neither authorizes Repair.

After verification, ACLH reports the result and waits. The user explicitly accepts the reviewed result or selects findings for Repair:

```bash
node .harness/scripts/review-decision.ts JIRA-101 --accept
node .harness/scripts/review-decision.ts JIRA-101 --repair EDGE-1
```

### Trust boundary

ACLH can enforce the **protocol** (separate record, distinct declared session ids, structured verdict/findings, exact repository snapshot, explicit user decision), but a repository-only tool cannot cryptographically prove that two Codex session IDs truly represent isolated model contexts. Therefore P1 does not claim cryptographic reviewer independence. A human review or an external orchestrator can provide a stronger identity boundary later.

## 4. Delivery order

The local completion sequence is:

```text
fresh machine evidence
  → fresh-context/human independent review
  → report findings and wait
  → explicit user accept or selected Repair
```

The installed pre-push hook enforces applicable local completion gates. CI separately enforces objective machine gates and provenance.

## P1 completion boundary

P1 includes:

1. real execution evidence for check/typecheck/test;
2. commit + worktree freshness;
3. evidence-backed blocking;
4. independent GitHub Actions provenance;
5. optional builder self-review kept distinct from independent semantic review;
6. a fresh-context/human review protocol bound to the exact repository snapshot;
7. a snapshot-bound explicit user decision before Delivery or Repair.

P1 does not include Semgrep, AST/dependency analysis, cryptographic reviewer identity, signed attestations, dashboards, or knowledge retrieval.
