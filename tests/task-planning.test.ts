import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';

const ENGINE_ROOT = process.cwd();

function git(root: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function run(projectRoot: string, script: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_PROJECT_ROOT: projectRoot },
  });
}

function createConsumer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-planning-'));
  git(root, ['init', '-b', 'agent/planning-contract']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.writeFileSync(path.join(root, 'README.md'), '# planning consumer\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('new tasks require authored spec, plan, and tasks before implementation', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-PLANNING-CONTRACT';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L2', '--strategy', 'tdd']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    const state = parseYaml(fs.readFileSync(path.join(taskDir, '.state.yaml'), 'utf8')) as {
      planning?: { contract?: unknown };
    };
    assert.equal(state.planning?.contract, 'spec-plan-tasks-v1');
    assert.equal(fs.existsSync(path.join(taskDir, 'plan.md')), true);

    const untouched = run(projectRoot, 'task-planning.ts', [taskId, '--verify']);
    assert.notEqual(untouched.status, 0);
    assert.match(untouched.stderr, /placeholder|incomplete/i);

    fs.writeFileSync(path.join(taskDir, 'spec.md'), [
      '# Specification', '',
      '## Problem', 'Users need a deterministic planning contract before implementation starts.', '',
      '## User Scenarios', 'A user can inspect refined behavior and boundaries before code is written.', '',
      '## Functional Requirements', '- The runtime verifies all planning documents.', '',
      '## Acceptance Criteria', '- [ ] Authored planning documents pass structural verification.', '',
      '## Edge Cases', '- Legacy tasks without the contract remain compatible.', '',
      '## Out of Scope', '- Semantic scoring of prose quality.', '',
    ].join('\n'));
    fs.writeFileSync(path.join(taskDir, 'plan.md'), [
      '# Plan', '',
      '## Technical Context', 'The external Runtime validates artifacts stored in the consumer repository.', '',
      '## Architecture', 'A dedicated verifier checks the declared planning contract.', '',
      '## Data Model and Contracts', 'Task state records spec-plan-tasks-v1.', '',
      '## Implementation Strategy', 'Implement templates, verifier, status integration, then tests.', '',
      '## Verification Strategy', 'Run focused external-consumer and complete lifecycle tests.', '',
      '## Risks and Mitigations', 'Legacy tasks opt out unless they declare the new contract.', '',
    ].join('\n'));
    fs.writeFileSync(path.join(taskDir, 'tasks.md'), [
      '# Tasks', '',
      '## Implementation Tasks', '- [ ] Add the planning verifier.', '',
      '## Dependencies', 'The templates define the verifier contract.', '',
      '## Verification Tasks', '- [ ] Prove untouched templates fail.', '',
      '## Acceptance Mapping', 'The verifier maps directly to the planning acceptance criteria.', '',
    ].join('\n'));

    const authored = run(projectRoot, 'task-planning.ts', [taskId, '--verify']);
    assert.equal(authored.status, 0, authored.stderr || authored.stdout);
    assert.match(authored.stdout, /Planning PASS/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
