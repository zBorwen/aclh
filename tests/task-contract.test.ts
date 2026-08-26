import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

test('task contract exposes bounded bootstrap choices without Runtime source inspection', () => {
  const result = spawnSync(process.execPath, [path.join('.harness/scripts/task-contract.ts'), '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const contract = JSON.parse(result.stdout) as {
    classification?: { primary?: unknown[]; traits?: unknown[] };
    risk_levels?: Record<string, unknown>;
    verification_strategies?: Record<string, unknown>;
    skills?: Array<{ id?: unknown; kind?: unknown }>;
    planning?: { contract?: unknown; order?: unknown };
    review?: { verdicts?: unknown; user_decision_required?: unknown };
    authoring?: {
      classification_yaml?: { example?: Record<string, unknown> };
      skill_plan_yaml?: { example?: Record<string, unknown> };
      verification_gaps_yaml?: { instruction?: unknown; example_without_browser?: { entries?: unknown[] } };
      skill_outputs?: Record<string, unknown>;
    };
    rules?: { browser_verification?: unknown; read_runtime_source_for_normal_bootstrap?: unknown };
  };
  assert.deepEqual(contract.classification?.primary, ['feature', 'bug', 'refactor', 'migration', 'integration']);
  assert.ok(contract.classification?.traits?.includes('performance-sensitive'));
  assert.ok(contract.risk_levels?.L2);
  assert.ok(contract.verification_strategies?.tdd);
  assert.deepEqual(contract.skills?.map(skill => skill.id).sort(), [
    'change-impact-analysis',
    'compatibility-verification',
    'regression-verification',
    'root-cause-analysis',
    'task-decomposition',
  ]);
  assert.equal(contract.planning?.contract, 'spec-plan-tasks-v1');
  assert.deepEqual(contract.planning?.order, ['spec.md', 'plan.md', 'tasks.md']);
  assert.deepEqual(contract.review?.verdicts, ['READY', 'READY_WITH_FINDINGS', 'NOT_READY']);
  assert.equal(contract.review?.user_decision_required, true);
  assert.equal(contract.authoring?.classification_yaml?.example?.task_id, '<TASK_ID>');
  assert.deepEqual(contract.authoring?.skill_plan_yaml?.example?.selected, ['task-decomposition']);
  assert.deepEqual(contract.authoring?.verification_gaps_yaml?.example_without_browser?.entries, []);
  assert.match(String(contract.authoring?.verification_gaps_yaml?.instruction), /Browser is opt-in/);
  assert.ok(contract.authoring?.skill_outputs?.['regression-verification']);
  assert.deepEqual(
    (contract.authoring?.skill_outputs?.['regression-verification'] as { artifacts?: Array<{ path?: unknown; required_sections?: unknown[] }> }).artifacts?.[0],
    {
      id: 'regression-verification',
      path: 'regression-verification.md',
      required_sections: ['Regression Scenarios', 'Observable Behavior', 'Test Coverage', 'Evidence'],
    },
  );
  assert.equal(contract.rules?.browser_verification, 'explicit-opt-in');
  assert.equal(contract.rules?.read_runtime_source_for_normal_bootstrap, false);
  assert.ok(result.stdout.length < 12_000, `bootstrap contract is too large: ${result.stdout.length}`);
});
