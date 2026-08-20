import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-delivery-consumer-'));
  git(root, ['init', '-b', 'agent/external-delivery']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const delivered = true;\n');
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({
    name: 'external-delivery-consumer',
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

test('external L2 consumer passes the complete P3 delivery chain without embedded Runtime files', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-EXTERNAL-DELIVERY';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L2', '--strategy', 'tdd']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);

    fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
      version: '1.0',
      task_id: taskId,
      classification: {
        primary: 'feature',
        traits: ['behavior-change'],
        confidence: 'high',
        rationale: ['exercise the complete external delivery chain'],
        ambiguities: [],
        source: 'codex',
      },
    }));
    assert.equal(run(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);

    fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
      version: '1.0',
      task_id: taskId,
      classification: { ref: 'classification.yaml' },
      selected: ['regression-verification'],
    }));
    const resolve = run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
    assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);

    fs.writeFileSync(path.join(taskDir, 'spec.md'), '# Spec\n\n- [x] External consumer lifecycle is governed without embedded Runtime files.\n');
    fs.writeFileSync(path.join(taskDir, 'tasks.md'), '# Tasks\n\n- [x] Build external delivery fixture.\n- [x] Verify all trust gates.\n');
    fs.writeFileSync(path.join(taskDir, 'test-plan.md'), [
      '# Test Plan', '',
      '- [x] consumer delivery chain', '',
      '## Verification Strategy', '',
      'strategy: tdd', '',
      '- [x] RED: external lifecycle fixture defined',
      '- [x] GREEN: external lifecycle passes',
      '- [x] REFACTOR: no embedded Runtime copied', '',
    ].join('\n'));
    fs.writeFileSync(path.join(taskDir, 'changelog.md'), '# Changelog\n\n- external L2 lifecycle prepared\n');
    fs.writeFileSync(path.join(taskDir, 'regression-verification.md'), [
      '# Regression Scenarios', '- Full L2 external lifecycle.', '',
      '# Observable Behavior', '- Delivery gate passes only with fresh trust artifacts.', '',
      '# Test Coverage', '- This fixture covers the complete external chain.', '',
      '# Evidence', '- Canonical consumer-bound Evidence is required.', '',
    ].join('\n'));

    const statePath = path.join(taskDir, '.state.yaml');
    const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as Record<string, unknown>;
    state.phase = 'testing';
    state.status = 'active';
    state.review_history = [];
    state.self_review = {
      run_at: new Date().toISOString(),
      gaps_found: [],
      root_fix_tracked: 'Engine remains outside consumer while governance state remains inside',
      notes: 'external L2 fixture reviewed before final Evidence',
      answers: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Q${index + 1}`, `verified ${index + 1}`])),
    };
    fs.writeFileSync(statePath, stringifyYaml(state));

    const scope = run(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(scope.status, 0, scope.stderr || scope.stdout);
    assert.equal(run(projectRoot, 'context-scope.ts', [taskId, '--verify']).status, 0);

    const context = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(context.status, 0, context.stderr || context.stdout);
    const contextVerify = run(projectRoot, 'context-select.ts', [taskId, '--verify']);
    assert.equal(contextVerify.status, 0, contextVerify.stderr || contextVerify.stdout);

    for (const gate of ['check', 'typecheck', 'test']) {
      const evidence = run(projectRoot, 'evidence.ts', [taskId, '--gate', gate]);
      assert.equal(evidence.status, 0, `${gate}: ${evidence.stderr || evidence.stdout}`);
    }

    const prepare = run(projectRoot, 'independent-review.ts', [taskId, '--prepare']);
    assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
    const packet = fs.readFileSync(path.join(taskDir, 'review-packet.md'), 'utf8');
    const snapshot = packetSnapshot(packet);
    fs.writeFileSync(path.join(taskDir, 'independent-review.json'), `${JSON.stringify({
      version: '1.0',
      task_id: taskId,
      builder: { session_id: 'builder-session' },
      reviewer: { kind: 'codex-fresh-context', session_id: 'review-session' },
      repository: snapshot,
      reviewed_at: new Date().toISOString(),
      verdict: 'PASS',
      findings: [],
      notes: 'fresh external review fixture',
    }, null, 2)}\n`);

    const delivery = run(projectRoot, 'delivery-gate.ts', [taskId]);
    assert.equal(delivery.status, 0, delivery.stderr || delivery.stdout);
    assert.match(delivery.stdout, /PASS for risk L2 \/ P3 Skill Plan/);
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness/scripts')), false);
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness/skills')), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
