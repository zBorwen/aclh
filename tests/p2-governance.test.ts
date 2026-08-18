import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

function run(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', env: env ?? process.env });
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

test('task identity is bound to the current branch and base commit', () => {
  const taskId = `TEST-P2-IDENTITY-${process.pid}`;
  cleanup(taskId);
  try {
    assert.equal(run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L0']).status, 0);
    const statePath = path.join(taskDir(taskId), '.state.yaml');
    const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as { identity: { branch: string; base_commit: string; pr_number: number | null } };
    assert.ok(state.identity.branch.length > 0);
    assert.match(state.identity.base_commit, /^[0-9a-f]{40}$/);
    assert.equal(state.identity.pr_number, null);
    const verify = run(['.harness/scripts/task-identity.ts', taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);

    state.identity.branch = 'definitely-not-current-branch';
    fs.writeFileSync(statePath, stringifyYaml(state));
    const wrongBranch = run(['.harness/scripts/task-identity.ts', taskId, '--verify']);
    assert.notEqual(wrongBranch.status, 0);
    assert.match(wrongBranch.stderr, /task belongs to branch definitely-not-current-branch/);
  } finally { cleanup(taskId); }
});

test('task identity supports explicit PR binding and validates PR context', () => {
  const taskId = `TEST-P2-PR-${process.pid}`;
  cleanup(taskId);
  try {
    assert.equal(run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L0']).status, 0);
    const bind = run(['.harness/scripts/task-identity.ts', taskId, '--bind-pr', '123']);
    assert.equal(bind.status, 0, bind.stderr || bind.stdout);
    const state = parseYaml(fs.readFileSync(path.join(taskDir(taskId), '.state.yaml'), 'utf8')) as { identity: { branch: string; pr_number: number } };
    const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_HEAD_REF: state.identity.branch, GITHUB_REF: 'refs/pull/124/merge' };
    const mismatch = run(['.harness/scripts/task-identity.ts', taskId, '--verify'], env);
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /task is bound to PR #123, CI is running for PR #124/);
  } finally { cleanup(taskId); }
});
