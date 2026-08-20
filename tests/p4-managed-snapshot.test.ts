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
function createConsumer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-managed-snapshot-'));
  git(root, ['init', '-b', 'agent/managed-snapshot']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.writeFileSync(path.join(root, 'README.md'), '# managed snapshot consumer\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('managed snapshot is Git-local sync state and does not invalidate machine Evidence', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-MANAGED-SNAPSHOT';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const evidence = run(projectRoot, 'evidence.ts', [taskId, '--gate', 'check']);
    assert.equal(evidence.status, 0, evidence.stderr || evidence.stdout);
    assert.equal(run(projectRoot, 'evidence.ts', [taskId, '--verify']).status, 0);

    const statusBefore = git(projectRoot, ['status', '--short']);
    const record = run(projectRoot, 'managed-snapshot.ts', [taskId, '--record']);
    assert.equal(record.status, 0, record.stderr || record.stdout);
    const statusAfter = git(projectRoot, ['status', '--short']);
    assert.equal(statusAfter, statusBefore, 'Git-local managed state must not add project diff');

    const gitPath = git(projectRoot, ['rev-parse', '--git-path', `aclh/managed/${taskId}.json`]);
    const snapshotPath = path.isAbsolute(gitPath) ? gitPath : path.resolve(projectRoot, gitPath);
    assert.equal(fs.existsSync(snapshotPath), true);
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { version: string; task_id: string; repository: { commit_sha: string } };
    assert.equal(snapshot.version, '1.0');
    assert.equal(snapshot.task_id, taskId);
    assert.equal(snapshot.repository.commit_sha, git(projectRoot, ['rev-parse', 'HEAD']));

    const verifyAfter = run(projectRoot, 'evidence.ts', [taskId, '--verify']);
    assert.equal(verifyAfter.status, 0, verifyAfter.stderr || verifyAfter.stdout);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
