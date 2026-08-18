import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';

function run(args: string[]) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
}
function taskDir(taskId: string) { return path.join('docs/wip', taskId); }
function cleanup(taskId: string) { fs.rmSync(taskDir(taskId), { recursive: true, force: true }); }

test('L0 requires only the check evidence gate', () => {
  const taskId = `TEST-P2-L0-${process.pid}`;
  cleanup(taskId);
  try {
    const init = run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L0']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const state = parseYaml(fs.readFileSync(path.join(taskDir(taskId), '.state.yaml'), 'utf8')) as { risk_level: string };
    assert.equal(state.risk_level, 'L0');
    const check = run(['.harness/scripts/evidence.ts', taskId, '--gate', 'check']);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    const verify = run(['.harness/scripts/evidence.ts', taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
    assert.match(verify.stdout, /risk L0, required gates = check/);
  } finally { cleanup(taskId); }
});

test('L1 does not accept check-only evidence', () => {
  const taskId = `TEST-P2-L1-${process.pid}`;
  cleanup(taskId);
  try {
    assert.equal(run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L1']).status, 0);
    assert.equal(run(['.harness/scripts/evidence.ts', taskId, '--gate', 'check']).status, 0);
    const verify = run(['.harness/scripts/evidence.ts', taskId, '--verify']);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /typecheck: missing or failing evidence/);
    assert.match(verify.stderr, /test: missing or failing evidence/);
  } finally { cleanup(taskId); }
});

test('L3 independent review rejects a fresh Codex reviewer and requires human', () => {
  const taskId = `TEST-P2-L3-${process.pid}`;
  cleanup(taskId);
  try {
    assert.equal(run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L3']).status, 0);
    const prepare = run(['.harness/scripts/independent-review.ts', taskId, '--prepare']);
    assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
    const packet = fs.readFileSync(path.join(taskDir(taskId), 'review-packet.md'), 'utf8');
    assert.match(packet, /requires a HUMAN reviewer/);
    const commit = packet.match(/- commit: ([0-9a-f]{40})/)?.[1];
    const worktree = packet.match(/- worktree: ([0-9a-f]{64})/)?.[1];
    assert.ok(commit && worktree);
    fs.writeFileSync(path.join(taskDir(taskId), 'independent-review.json'), JSON.stringify({
      version: '1.0', task_id: taskId,
      reviewer: { kind: 'codex-fresh-context', session_id: 'reviewer-B' },
      builder: { session_id: 'builder-A' },
      repository: { commit_sha: commit, worktree_sha256: worktree },
      reviewed_at: new Date().toISOString(), verdict: 'PASS', findings: [], notes: 'test'
    }, null, 2));
    const verify = run(['.harness/scripts/independent-review.ts', taskId, '--verify']);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /risk policy requires reviewer.kind=human/);
  } finally { cleanup(taskId); }
});

test('init-task rejects unknown risk levels', () => {
  const taskId = `TEST-P2-BAD-RISK-${process.pid}`;
  cleanup(taskId);
  const result = run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L9']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid risk level/);
  cleanup(taskId);
});

test('component strategy is recorded and requires component-specific verification markers', () => {
  const taskId = `TEST-P2-COMPONENT-${process.pid}`;
  cleanup(taskId);
  try {
    const init = run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L1', '--strategy', 'component']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const state = parseYaml(fs.readFileSync(path.join(taskDir(taskId), '.state.yaml'), 'utf8')) as { verification_strategy: string };
    assert.equal(state.verification_strategy, 'component');
    const planPath = path.join(taskDir(taskId), 'test-plan.md');
    const plan = fs.readFileSync(planPath, 'utf8');
    assert.match(plan, /strategy: component/);
    assert.match(plan, /COMPONENT_TEST/);
    assert.match(plan, /INTERACTION_CHECK/);

    const incomplete = run(['.harness/scripts/verification-plan.ts', taskId]);
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /COMPONENT_TEST/);

    fs.writeFileSync(planPath, plan.replaceAll('- [ ] COMPONENT_TEST:', '- [x] COMPONENT_TEST:').replaceAll('- [ ] INTERACTION_CHECK:', '- [x] INTERACTION_CHECK:'));
    const complete = run(['.harness/scripts/verification-plan.ts', taskId]);
    assert.equal(complete.status, 0, complete.stderr || complete.stdout);
  } finally { cleanup(taskId); }
});

test('docs strategy does not inherit TDD markers', () => {
  const taskId = `TEST-P2-DOCS-${process.pid}`;
  cleanup(taskId);
  try {
    assert.equal(run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L0', '--strategy', 'docs']).status, 0);
    const plan = fs.readFileSync(path.join(taskDir(taskId), 'test-plan.md'), 'utf8');
    assert.match(plan, /DOC_STRUCTURE/);
    assert.match(plan, /LINK_OR_EXAMPLE_CHECK/);
    assert.doesNotMatch(plan, /- \[ \] RED:/);
    assert.doesNotMatch(plan, /- \[ \] GREEN:/);
  } finally { cleanup(taskId); }
});

test('init-task rejects unknown verification strategies', () => {
  const taskId = `TEST-P2-BAD-STRATEGY-${process.pid}`;
  cleanup(taskId);
  const result = run(['.harness/scripts/init-task.ts', taskId, '--strategy', 'magic']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid verification strategy/);
  cleanup(taskId);
});
