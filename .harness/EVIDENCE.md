# ACLH Evidence Model v1.1

Evidence turns a claimed machine check into a recorded execution result that is bound to the repository state it verified.

## Scope

v1.1 supports three required repository gates:

| Gate | Command | Required before push |
|---|---|---|
| `check` | `npm run check` | yes |
| `typecheck` | `npm run typecheck` | yes |
| `test` | `npm test` | yes |

Each initialized task owns `docs/wip/<TASK_ID>/evidence.json`.

## Freshness model

Every gate is bound to two repository identifiers:

- `commit_sha`: the current `git rev-parse HEAD` value.
- `worktree_sha256`: a SHA-256 fingerprint of tracked changes plus untracked file contents.

The task's own `evidence.json` is excluded from the worktree fingerprint so recording evidence does not invalidate itself.

A gate is fresh only when its recorded repository snapshot exactly matches the current repository snapshot. Therefore any later commit, staged change, unstaged change, or untracked-file content change invalidates previously recorded PASS evidence.

The recorder snapshots the repository both before and after running a gate. If the gate itself mutates repository state, the evidence is recorded as `FAIL` even when the command exits with code 0.

## Record shape

```json
{
  "version": "1.1",
  "task_id": "JIRA-101",
  "updated_at": "2026-08-19T00:00:00.000Z",
  "gates": {
    "typecheck": {
      "gate": "typecheck",
      "command": "npm run typecheck",
      "started_at": "...",
      "finished_at": "...",
      "exit_code": 0,
      "result": "PASS",
      "repository": {
        "commit_sha": "0123456789abcdef...",
        "worktree_sha256": "abcdef012345..."
      },
      "repository_unchanged": true
    }
  }
}
```

## Commands

```bash
npm run evidence -- JIRA-101 --gate check
npm run evidence -- JIRA-101 --gate typecheck
npm run evidence -- JIRA-101 --gate test
npm run evidence -- JIRA-101 --verify
```

`--gate` executes the canonical command, confirms the repository did not change during execution, and records the result plus repository snapshot.

`--verify` does not rerun commands. It requires all three gates to contain PASS evidence for the exact current repository snapshot. Stale evidence blocks verification.

## Upgrade from v1.0

v1.0 records do not contain repository identity and therefore cannot prove freshness. When v1.1 reads a v1.0 evidence file, all prior gate results are discarded and must be recaptured.

## Trust boundary

v1.1 closes the stale-evidence gap, but it is still **repository-local execution evidence**, not tamper-proof attestation. A repository writer can edit both code and `evidence.json`.

The model now proves that the Harness-recorded gate result corresponds to a specific local repository snapshot. It does not yet prove who executed the command, which CI runner executed it, or that the JSON itself was not manually forged.

Later P1 work may add CI provenance, verifier identity, output digests, and signed or server-side attestations.
