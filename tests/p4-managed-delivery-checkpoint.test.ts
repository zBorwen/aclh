import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const ENGINE_ROOT = process.cwd();

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
function run(projectRoot: string, script: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_RUNTIME_ROOT: ENGINE_ROOT, ACLH_PROJECT_ROOT: projectRoot },
  });
}

test('successful delivery records the final managed checkpoint automatically', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-managed-delivery-'));
  const taskId = 'TASK-MANAGED-DELIVERY';
  try {
    git(projectRoot, ['init', '-b', 'agent/managed-delivery']);
    git(projectRoot, ['config', 'user.email', 'aclh-test@example.com']);
    git(projectRoot, ['config', 'user.name', 'ACLH Test']);
    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# managed delivery consumer\n');
    git(projectRoot, ['add', '.']);
    git(projectRoot, ['commit', '-m', 'initial consumer']);

    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    fs.writeFileSync(path.join(taskDir, 'spec.md'), [
      '# Specification', '',
      '## Problem', 'Successful Delivery must record a managed checkpoint.', '',
      '## User Scenarios', 'A completed task can resume later from a known managed state.', '',
      '## Functional Requirements', '- Delivery records its final repository snapshot.', '',
      '## Acceptance Criteria', '- [x] Managed state exists after Delivery.', '',
      '## Edge Cases', '- Generated checkpoint state must not dirty the consumer worktree.', '',
      '## Out of Scope', '- Human handoff behavior after subsequent product changes.', '',
    ].join('\n'));
    fs.writeFileSync(path.join(taskDir, 'plan.md'), [
      '# Plan', '',
      '## Technical Context', 'The external Runtime stores managed state under the consumer Git directory.', '',
      '## Architecture', 'Delivery invokes managed-snapshot after all prior gates pass.', '',
      '## Data Model and Contracts', 'The checkpoint is a Git-local JSON snapshot record.', '',
      '## Implementation Strategy', 'Complete an L0 docs task and inspect its final checkpoint.', '',
      '## Verification Strategy', 'Assert file existence and a clean worktree after Delivery.', '',
      '## Risks and Mitigations', 'Git-local storage avoids adding generated task state to source control.', '',
    ].join('\n'));
    fs.writeFileSync(path.join(taskDir, 'tasks.md'), [
      '# Tasks', '',
      '## Implementation Tasks', '- [x] Complete the managed Delivery fixture.', '',
      '## Dependencies', 'Canonical check Evidence precedes Delivery.', '',
      '## Verification Tasks', '- [x] Verify the checkpoint and clean worktree.', '',
      '## Acceptance Mapping', 'The file and Git assertions cover the specification criteria.', '',
    ].join('\n'));
    const planPath = path.join(taskDir, 'test-plan.md');
    const plan = fs.readFileSync(planPath, 'utf8')
      .replace('- [ ] DOC_STRUCTURE:', '- [x] DOC_STRUCTURE:')
      .replace('- [ ] LINK_OR_EXAMPLE_CHECK:', '- [x] LINK_OR_EXAMPLE_CHECK:');
    fs.writeFileSync(planPath, plan);

    const evidence = run(projectRoot, 'evidence.ts', [taskId, '--gate', 'check']);
    assert.equal(evidence.status, 0, evidence.stderr || evidence.stdout);
    const delivery = run(projectRoot, 'delivery-gate.ts', [taskId]);
    assert.equal(delivery.status, 0, delivery.stderr || delivery.stdout);

    const gitPath = git(projectRoot, ['rev-parse', '--git-path', `aclh/managed/${taskId}.json`]);
    const snapshotPath = path.isAbsolute(gitPath) ? gitPath : path.resolve(projectRoot, gitPath);
    assert.equal(fs.existsSync(snapshotPath), true);
    assert.equal(git(projectRoot, ['status', '--short']).includes('managed-snapshot'), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
