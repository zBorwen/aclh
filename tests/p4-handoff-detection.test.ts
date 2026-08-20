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
function run(projectRoot: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts/managed-snapshot.ts'), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_RUNTIME_ROOT: ENGINE_ROOT, ACLH_PROJECT_ROOT: projectRoot },
  });
}
function createConsumer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-handoff-detection-'));
  git(root, ['init', '-b', 'agent/handoff-detection']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.writeFileSync(path.join(root, 'README.md'), '# handoff detection consumer\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('managed status distinguishes unknown, clean, uncommitted change and human commit', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-HANDOFF-DETECTION';
  try {
    const init = spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts/init-task.ts'), taskId, '--risk', 'L0', '--strategy', 'docs'], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, ACLH_RUNTIME_ROOT: ENGINE_ROOT, ACLH_PROJECT_ROOT: projectRoot },
    });
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const unknown = run(projectRoot, [taskId, '--status', '--json']);
    assert.equal(unknown.status, 3);
    assert.equal(JSON.parse(unknown.stdout).status, 'unknown');

    const record = run(projectRoot, [taskId, '--record']);
    assert.equal(record.status, 0, record.stderr || record.stdout);
    const clean = run(projectRoot, [taskId, '--status', '--json']);
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);
    assert.equal(JSON.parse(clean.stdout).status, 'clean');

    const originalReadme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# human edited this locally\n');
    const dirty = run(projectRoot, [taskId, '--status', '--json']);
    assert.equal(dirty.status, 2);
    const dirtyResult = JSON.parse(dirty.stdout) as { status: string; commit_changed: boolean; worktree_changed: boolean };
    assert.equal(dirtyResult.status, 'changed');
    assert.equal(dirtyResult.commit_changed, false);
    assert.equal(dirtyResult.worktree_changed, true);

    fs.writeFileSync(path.join(projectRoot, 'README.md'), originalReadme);
    assert.equal(run(projectRoot, [taskId, '--status']).status, 0);

    fs.writeFileSync(path.join(projectRoot, 'HUMAN.md'), '# human commit\n');
    git(projectRoot, ['add', '.']);
    git(projectRoot, ['commit', '-m', 'human: small manual edit']);
    const committed = run(projectRoot, [taskId, '--status', '--json']);
    assert.equal(committed.status, 2);
    const committedResult = JSON.parse(committed.stdout) as { status: string; commit_changed: boolean };
    assert.equal(committedResult.status, 'changed');
    assert.equal(committedResult.commit_changed, true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
