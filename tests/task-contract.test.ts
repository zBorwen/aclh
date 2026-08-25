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
  assert.ok(result.stdout.length < 12_000, `bootstrap contract is too large: ${result.stdout.length}`);
});
