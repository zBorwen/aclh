# ACLH Evidence Model v1

Evidence turns a claimed machine check into a recorded execution result.

## Scope

v1 intentionally supports only three repository gates:

| Gate | Command | Required before push |
|---|---|---|
| `check` | `npm run check` | yes |
| `typecheck` | `npm run typecheck` | yes |
| `test` | `npm test` | yes |

Each initialized task owns `docs/wip/<TASK_ID>/evidence.json`.

## Record shape

```json
{
  "version": "1.0",
  "task_id": "JIRA-101",
  "updated_at": "2026-08-19T00:00:00.000Z",
  "gates": {
    "check": {
      "gate": "check",
      "command": "npm run check",
      "started_at": "...",
      "finished_at": "...",
      "exit_code": 0,
      "result": "PASS"
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

`--gate` executes the canonical command and writes its result. `--verify` does not rerun commands; it verifies that all required gates have a recorded PASS with the expected command and exit code.

## Trust boundary

v1 evidence is **repository-local execution evidence**, not tamper-proof attestation. A user with repository write access can edit `evidence.json`. Therefore v1 is sufficient for deterministic local workflow enforcement, but it is not yet suitable as cryptographic or independent audit proof.

Future versions may bind evidence to commit SHA, environment, CI run identity, output digest, and independent verifier provenance.
