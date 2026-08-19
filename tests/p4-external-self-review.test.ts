import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

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
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('Builder self-review reads task artifacts from consumer and AGENTS contract from Engine', () => {
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

    const statePath = path.join(taskDir, '.state.yaml');
    const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as Record<string, unknown>;
    state.phase = 'testing';
    state.status = 'active';
    state.review_history = [];
    state.self_review = {
      run_at: new Date().toISOString(),
      gaps_found: [],
      root_fix_tracked: 'external consumer ownership remains intact',
      notes: 'reviewed consumer task artifacts against Engine contract',
      answers: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Q${index + 1}`, `answer ${index + 1}`])),
    };
    fs.writeFileSync(statePath, stringifyYaml(state));

    assert.equal(fs.existsSync(path.join(projectRoot, 'AGENTS.md')), false);
    const review = run(projectRoot, 'self-review.ts', [taskId]);
    assert.equal(review.status, 0, review.stderr || review.stdout);
    assert.match(review.stdout, /\[PASS\] Adversarial Self-Review/);
    assert.match(review.stdout, /contract:agents\.md.*present in ACLH Engine/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
