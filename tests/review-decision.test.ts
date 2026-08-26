import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-review-decision-'));
  git(root, ['init', '-b', 'agent/review-decision']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.writeFileSync(path.join(root, 'README.md'), '# review decision consumer\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

function packetSnapshot(packet: string): { commit_sha: string; worktree_sha256: string } {
  const commit = packet.match(/^- commit: ([0-9a-f]{40})$/m)?.[1];
  const worktree = packet.match(/^- worktree: ([0-9a-f]{64})$/m)?.[1];
  assert.ok(commit);
  assert.ok(worktree);
  return { commit_sha: commit, worktree_sha256: worktree };
}

test('review findings wait for an explicit user accept or repair decision', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-REVIEW-DECISION';
  try {
    assert.equal(run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L2', '--strategy', 'tdd']).status, 0);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    assert.equal(run(projectRoot, 'independent-review.ts', [taskId, '--prepare']).status, 0);
    const snapshot = packetSnapshot(fs.readFileSync(path.join(taskDir, 'review-packet.md'), 'utf8'));
    fs.writeFileSync(path.join(taskDir, 'independent-review.json'), `${JSON.stringify({
      version: '1.1',
      task_id: taskId,
      builder: { session_id: 'builder-session' },
      reviewer: { kind: 'codex-fresh-context', session_id: 'review-session' },
      repository: snapshot,
      reviewed_at: new Date().toISOString(),
      verdict: 'READY_WITH_FINDINGS',
      findings: [{
        id: 'EDGE-1',
        category: 'edge-case',
        severity: 'minor',
        summary: 'An optional edge case is not covered.',
        evidence: 'The test matrix has no corresponding case.',
        recommendation: 'Consider adding coverage if the user values this boundary.',
      }],
      notes: 'Implementation is usable; finding is optional.',
    }, null, 2)}\n`);

    const review = run(projectRoot, 'independent-review.ts', [taskId, '--verify']);
    assert.equal(review.status, 0, review.stderr || review.stdout);
    assert.match(review.stdout, /READY_WITH_FINDINGS/);

    const missing = run(projectRoot, 'review-decision.ts', [taskId, '--verify']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /decision.*missing/i);

    const repair = run(projectRoot, 'review-decision.ts', [taskId, '--repair', 'EDGE-1']);
    assert.equal(repair.status, 0, repair.stderr || repair.stdout);
    assert.equal(fs.existsSync(path.join(taskDir, 'review-decision.json')), false);
    assert.equal(fs.existsSync(path.join(taskDir, 'independent-review.json')), false);
    const repairAuthorization = JSON.parse(fs.readFileSync(path.join(taskDir, 'repair-authorization.json'), 'utf8'));
    assert.equal(repairAuthorization.decision, 'repair');
    assert.deepEqual(repairAuthorization.findings, ['EDGE-1']);
    const history = JSON.parse(fs.readFileSync(path.join(taskDir, 'review-history.json'), 'utf8'));
    assert.equal(history.rounds.length, 1);
    assert.equal(history.rounds[0].decision.decision, 'repair');
    const status = run(projectRoot, 'task-status.ts', [taskId, '--json']);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.equal(JSON.parse(status.stdout).next_action, 'repair-user-selected-findings');

    const secondRepair = run(projectRoot, 'review-decision.ts', [taskId, '--repair', 'EDGE-1']);
    assert.notEqual(secondRepair.status, 0);
    assert.match(secondRepair.stderr, /review is missing/i);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
