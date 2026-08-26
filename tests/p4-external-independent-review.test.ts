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
    env: { ...process.env, ACLH_PROJECT_ROOT: projectRoot },
  });
}
function createConsumer(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `aclh-independent-${name}-`));
  git(root, ['init', '-b', `agent/${name}`]);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.writeFileSync(path.join(root, 'README.md'), `# ${name}\n`);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}
function packetSnapshot(packet: string): { commit_sha: string; worktree_sha256: string } {
  const commit = packet.match(/^- commit: ([0-9a-f]{40})$/m)?.[1];
  const worktree = packet.match(/^- worktree: ([0-9a-f]{64})$/m)?.[1];
  assert.ok(commit, 'review packet commit missing');
  assert.ok(worktree, 'review packet worktree missing');
  return { commit_sha: commit, worktree_sha256: worktree };
}
function writeReview(taskDir: string, taskId: string, snapshot: { commit_sha: string; worktree_sha256: string }, reviewerKind: 'codex-fresh-context' | 'human'): void {
  fs.writeFileSync(path.join(taskDir, 'independent-review.json'), `${JSON.stringify({
    version: '1.0',
    task_id: taskId,
    builder: { session_id: 'builder-session' },
    reviewer: { kind: reviewerKind, session_id: 'review-session' },
    repository: snapshot,
    reviewed_at: new Date().toISOString(),
    verdict: 'PASS',
    findings: [],
    notes: 'external consumer review',
  }, null, 2)}\n`);
}

test('L2 independent review binds to the consumer repository and becomes stale after consumer change', () => {
  const projectRoot = createConsumer(`l2-${process.pid}`);
  const taskId = 'TASK-EXTERNAL-INDEPENDENT-L2';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L2', '--strategy', 'tdd']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    const prepare = run(projectRoot, 'independent-review.ts', [taskId, '--prepare']);
    assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
    const packet = fs.readFileSync(path.join(taskDir, 'review-packet.md'), 'utf8');
    const snapshot = packetSnapshot(packet);
    assert.equal(snapshot.commit_sha, git(projectRoot, ['rev-parse', 'HEAD']));
    assert.match(packet, /FRESH Codex context or use a human reviewer/);
    assert.match(packet, /Artifact sources/);
    assert.match(packet, /docs\/wip\/TASK-EXTERNAL-INDEPENDENT-L2\/spec\.md/);
    assert.match(packet, /write only independent-review\.json/);
    assert.match(packet, /must not modify product code, task planning, Context, Evidence, or other Builder artifacts/);
    assert.match(packet, /never starts Repair/);

    writeReview(taskDir, taskId, snapshot, 'codex-fresh-context');
    const verify = run(projectRoot, 'independent-review.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);

    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# changed by human\n');
    const stale = run(projectRoot, 'independent-review.ts', [taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /stale for the current repository snapshot/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('L3 external review still requires a human reviewer', () => {
  const projectRoot = createConsumer(`l3-${process.pid}`);
  const taskId = 'TASK-EXTERNAL-INDEPENDENT-L3';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L3', '--strategy', 'config']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    const prepare = run(projectRoot, 'independent-review.ts', [taskId, '--prepare']);
    assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
    const packet = fs.readFileSync(path.join(taskDir, 'review-packet.md'), 'utf8');
    const snapshot = packetSnapshot(packet);
    assert.match(packet, /requires a HUMAN reviewer/);

    writeReview(taskDir, taskId, snapshot, 'codex-fresh-context');
    const rejected = run(projectRoot, 'independent-review.ts', [taskId, '--verify']);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /requires reviewer.kind=human/);

    writeReview(taskDir, taskId, snapshot, 'human');
    const accepted = run(projectRoot, 'independent-review.ts', [taskId, '--verify']);
    assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
