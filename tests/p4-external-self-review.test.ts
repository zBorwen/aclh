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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-self-review-'));
  git(root, ['init', '-b', 'agent/external-self-review']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.writeFileSync(path.join(root, 'README.md'), '# consumer\n');
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({
    name: 'external-self-review-consumer',
    private: true,
    scripts: {
      typecheck: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
    },
  }, null, 2)}\n`);
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

test('Builder self-review is prepared before Evidence, snapshot-bound, and recorded outside task state', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-EXTERNAL-SELF-REVIEW';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L1', '--strategy', 'tdd']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    fs.writeFileSync(path.join(taskDir, 'spec.md'), '# Spec\n\n- [x] acceptance verified\n');
    fs.writeFileSync(path.join(taskDir, 'tasks.md'), '# Tasks\n\n- [x] regression test complete\n');
    fs.writeFileSync(path.join(taskDir, 'test-plan.md'), '# Test Plan\n\n- [x] test complete\n');
    fs.writeFileSync(path.join(taskDir, 'changelog.md'), '# Changelog\n\n- external self-review prepared\n');

    const prepare = run(projectRoot, 'self-review.ts', [taskId, '--prepare']);
    assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
    const state = parseYaml(fs.readFileSync(path.join(taskDir, '.state.yaml'), 'utf8')) as { phase?: unknown };
    assert.equal(state.phase, 'testing');

    for (const gate of ['check', 'typecheck', 'test']) {
      const evidence = run(projectRoot, 'evidence.ts', [taskId, '--gate', gate]);
      assert.equal(evidence.status, 0, `${gate}: ${evidence.stderr || evidence.stdout}`);
    }

    const packet = fs.readFileSync(path.join(taskDir, 'self-review-packet.md'), 'utf8');
    const review = {
      version: '1.0',
      task_id: taskId,
      repository: packetSnapshot(packet),
      run_at: new Date().toISOString(),
      gaps_found: [],
      root_fix_tracked: 'external consumer ownership remains intact',
      notes: 'reviewed consumer task artifacts against Engine contract',
      answers: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Q${index + 1}`, `answer ${index + 1}`])),
    };
    fs.writeFileSync(path.join(taskDir, 'self-review.json'), `${JSON.stringify(review, null, 2)}\n`);

    assert.equal(fs.existsSync(path.join(projectRoot, 'AGENTS.md')), false);
    const verify = run(projectRoot, 'self-review.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
    assert.match(verify.stdout, /\[PASS\] Adversarial Self-Review/);
    assert.match(verify.stdout, /contract:agents\.md.*present in ACLH Engine/);

    const evidenceVerify = run(projectRoot, 'evidence.ts', [taskId, '--verify']);
    assert.equal(evidenceVerify.status, 0, evidenceVerify.stderr || evidenceVerify.stdout);

    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# changed after self-review\n');
    const stale = run(projectRoot, 'self-review.ts', [taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr + stale.stdout, /self-review is stale for the current repository snapshot/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
