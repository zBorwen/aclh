import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { stringify as stringifyYaml } from 'yaml';

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

    const initialStatus = run(projectRoot, 'task-status.ts', [taskId, '--json']);
    assert.equal(initialStatus.status, 0, initialStatus.stderr || initialStatus.stdout);
    assert.equal(JSON.parse(initialStatus.stdout).review_ready, false);
    assert.equal(JSON.parse(initialStatus.stdout).next_action, 'author-or-fix-classification');
    assert.deepEqual(JSON.parse(initialStatus.stdout).failures, ['classification']);

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

    fs.writeFileSync(path.join(taskDir, 'spec.md'), [
      '# Specification', '',
      '## Problem', 'External consumers need a complete governed delivery lifecycle without copied Runtime files.', '',
      '## User Scenarios', 'A Builder can implement and verify while an independent reviewer remains read-only.', '',
      '## Functional Requirements', '- Runtime commands operate against consumer-owned task artifacts.', '',
      '## Acceptance Criteria', '- [x] External delivery completes only after explicit user acceptance.', '',
      '## Edge Cases', '- Review findings must not automatically trigger product changes.', '',
      '## Out of Scope', '- Embedding Engine implementation in the consumer repository.', '',
    ].join('\n'));
    fs.writeFileSync(path.join(taskDir, 'plan.md'), [
      '# Plan', '',
      '## Technical Context', 'The Engine is external and receives ACLH_PROJECT_ROOT for every transition.', '',
      '## Architecture', 'Consumer artifacts are verified by Engine-owned scripts without Runtime copies.', '',
      '## Data Model and Contracts', 'Task, Evidence, Review, and decision records stay in docs/wip.', '',
      '## Implementation Strategy', 'Exercise every transition with a temporary external Git repository.', '',
      '## Verification Strategy', 'Run canonical gates, fresh review, decision, and Delivery in order.', '',
      '## Risks and Mitigations', 'Snapshot checks reject stale Evidence, Review, and user decisions.', '',
    ].join('\n'));
    fs.writeFileSync(path.join(taskDir, 'tasks.md'), [
      '# Tasks', '',
      '## Implementation Tasks', '- [x] Build the external delivery fixture and governed artifacts.', '',
      '## Dependencies', 'Planning and Context precede machine Evidence and independent Review.', '',
      '## Verification Tasks', '- [x] Verify Review stops for an explicit user decision.', '',
      '## Acceptance Mapping', 'The fixture covers every requirement in the external lifecycle specification.', '',
    ].join('\n'));
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

    const scope = run(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(scope.status, 0, scope.stderr || scope.stdout);
    assert.equal(run(projectRoot, 'context-scope.ts', [taskId, '--verify']).status, 0);

    const context = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(context.status, 0, context.stderr || context.stdout);
    const contextVerify = run(projectRoot, 'context-select.ts', [taskId, '--verify']);
    assert.equal(contextVerify.status, 0, contextVerify.stderr || contextVerify.stdout);

    const beforeGaps = run(projectRoot, 'task-status.ts', [taskId, '--json']);
    assert.equal(beforeGaps.status, 0, beforeGaps.stderr || beforeGaps.stdout);
    assert.equal(JSON.parse(beforeGaps.stdout).next_action, 'complete-task-and-skill-artifacts');
    assert.ok(JSON.parse(beforeGaps.stdout).failures.includes('verification-gaps-check'));

    fs.writeFileSync(path.join(taskDir, 'verification-gaps.yaml'), stringifyYaml({
      version: '1.1', task_id: taskId,
      assessment: { source: 'codex', summary: 'Behavioral regression has explicit machine coverage; no browser proof is required.' },
      entries: [
        {
          id: 'behavior-regression', dimension: 'behavior-regression',
          description: 'Verify the external lifecycle regression behavior.', status: 'machine-covered',
          machine_gates: ['test'],
        },
      ],
    }));
    const gapCheck = run(projectRoot, 'verification-gaps.ts', [taskId, '--check']);
    assert.equal(gapCheck.status, 0, gapCheck.stderr || gapCheck.stdout);

    const finalize = run(projectRoot, 'builder-finalize.ts', [taskId, '--json']);
    assert.equal(finalize.status, 0, finalize.stderr || finalize.stdout);
    const finalized = JSON.parse(finalize.stdout);
    assert.equal(finalized.builder_ready, true);
    assert.equal(finalized.browser, 'not-required');
    assert.equal(finalized.steps.find((step: { id: string }) => step.id === 'browser-verification').status, 'skip');
    assert.equal(fs.existsSync(path.join(taskDir, 'browser-verification.json')), false);

    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    packageJson.scripts['test:browser'] = 'node -e "process.exit(0)"';
    fs.writeFileSync(path.join(projectRoot, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
    fs.writeFileSync(path.join(taskDir, 'verification-gaps.yaml'), stringifyYaml({
      version: '1.1', task_id: taskId,
      assessment: { source: 'codex', summary: 'The request now explicitly includes a browser proof.' },
      entries: [{
        id: 'browser-interaction', dimension: 'browser-interaction',
        description: 'Exercise the explicitly requested browser verification path.', status: 'machine-covered',
        machine_proofs: ['browser'],
      }],
    }));
    const browserFinalize = run(projectRoot, 'builder-finalize.ts', [taskId, '--json']);
    assert.equal(browserFinalize.status, 0, browserFinalize.stderr || browserFinalize.stdout);
    assert.equal(JSON.parse(browserFinalize.stdout).browser, 'required-and-run');
    assert.equal(fs.existsSync(path.join(taskDir, 'browser-verification.json')), true);

    const beforeReview = run(projectRoot, 'task-status.ts', [taskId, '--review-ready', '--json']);
    assert.equal(beforeReview.status, 2, beforeReview.stderr || beforeReview.stdout);
    assert.equal(JSON.parse(beforeReview.stdout).next_action, 'prepare-independent-review');

    const prepare = run(projectRoot, 'independent-review.ts', [taskId, '--prepare']);
    assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
    const ready = run(projectRoot, 'task-status.ts', [taskId, '--review-ready', '--json']);
    assert.equal(ready.status, 0, ready.stderr || ready.stdout);
    assert.equal(JSON.parse(ready.stdout).review_ready, true);
    assert.equal(JSON.parse(ready.stdout).next_action, 'run-independent-review');
    const packet = fs.readFileSync(path.join(taskDir, 'review-packet.md'), 'utf8');
    const snapshot = packetSnapshot(packet);
    fs.writeFileSync(path.join(taskDir, 'independent-review.json'), `${JSON.stringify({
      version: '1.1',
      task_id: taskId,
      builder: { session_id: 'builder-session' },
      reviewer: { kind: 'codex-fresh-context', session_id: 'review-session' },
      repository: snapshot,
      reviewed_at: new Date().toISOString(),
      verdict: 'READY_WITH_FINDINGS',
      findings: [{
        id: 'OPT-1',
        category: 'optimization',
        severity: 'suggestion',
        summary: 'The fixture could use a smaller package manifest.',
        evidence: 'Only no-op scripts are required for this lifecycle test.',
        recommendation: 'Consider simplifying the fixture in a later cleanup.',
      }],
      notes: 'fresh external review fixture',
    }, null, 2)}\n`);

    const reviewed = run(projectRoot, 'task-status.ts', [taskId, '--json']);
    assert.equal(reviewed.status, 0, reviewed.stderr || reviewed.stdout);
    assert.equal(JSON.parse(reviewed.stdout).next_action, 'report-review-and-await-user');
    assert.equal(JSON.parse(reviewed.stdout).review_decision, 'none');

    const blockedDelivery = run(projectRoot, 'delivery-gate.ts', [taskId]);
    assert.notEqual(blockedDelivery.status, 0);
    assert.match(blockedDelivery.stderr + blockedDelivery.stdout, /decision record is missing/);

    const repair = run(projectRoot, 'review-decision.ts', [taskId, '--repair', 'OPT-1']);
    assert.equal(repair.status, 0, repair.stderr || repair.stdout);
    const repairStatus = run(projectRoot, 'task-status.ts', [taskId, '--json']);
    assert.equal(JSON.parse(repairStatus.stdout).next_action, 'repair-user-selected-findings');
    assert.equal(fs.existsSync(path.join(taskDir, 'independent-review.json')), false);
    fs.appendFileSync(path.join(taskDir, 'changelog.md'), '- repaired OPT-1\n');
    const repairFinalize = run(projectRoot, 'builder-finalize.ts', [taskId, '--json']);
    assert.equal(repairFinalize.status, 0, repairFinalize.stderr || repairFinalize.stdout);
    assert.equal(fs.existsSync(path.join(taskDir, 'repair-authorization.json')), false);
    const secondPrepare = run(projectRoot, 'independent-review.ts', [taskId, '--prepare']);
    assert.equal(secondPrepare.status, 0, secondPrepare.stderr || secondPrepare.stdout);
    const secondPacket = fs.readFileSync(path.join(taskDir, 'review-packet.md'), 'utf8');
    const secondSnapshot = packetSnapshot(secondPacket);
    fs.writeFileSync(path.join(taskDir, 'independent-review.json'), `${JSON.stringify({
      version: '1.1', task_id: taskId,
      builder: { session_id: 'builder-session' },
      reviewer: { kind: 'codex-fresh-context', session_id: 'second-review-session' },
      repository: secondSnapshot,
      reviewed_at: new Date().toISOString(), verdict: 'READY', findings: [],
      notes: 'fresh review after the explicitly authorized repair',
    }, null, 2)}\n`);
    const secondReviewed = run(projectRoot, 'task-status.ts', [taskId, '--json']);
    assert.equal(JSON.parse(secondReviewed.stdout).next_action, 'report-review-and-await-user');

    const accept = run(projectRoot, 'review-decision.ts', [taskId, '--accept']);
    assert.equal(accept.status, 0, accept.stderr || accept.stdout);
    const acceptedStatus = run(projectRoot, 'task-status.ts', [taskId, '--json']);
    assert.equal(JSON.parse(acceptedStatus.stdout).next_action, 'run-delivery-gate');

    const delivery = run(projectRoot, 'delivery-gate.ts', [taskId]);
    assert.equal(delivery.status, 0, delivery.stderr || delivery.stdout);
    assert.match(delivery.stdout, /PASS for risk L2 \/ P3 Skill Plan/);
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness/scripts')), false);
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness/skills')), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
