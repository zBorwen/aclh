import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function run(args: string[]) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('check resolves the configured preset as the single plugin source', () => {
  const result = run(['.harness/scripts/check.ts', '--format', 'json']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    harness_check: string;
    active_preset: string | null;
    active_plugins: string[];
  };

  assert.equal(report.harness_check, 'PASS');
  assert.equal(report.active_preset, 'full-lifecycle');
  assert.ok(report.active_plugins.includes('naming-frontend'));
  assert.ok(report.active_plugins.includes('tdd-workflow'));
  assert.ok(report.active_plugins.includes('pr-review'));
});

test('init-task rejects traversal-like task identifiers', () => {
  const result = run(['.harness/scripts/init-task.ts', '../escape']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid task ID/);
});

test('self-review rejects malformed task identifiers', () => {
  const result = run(['.harness/scripts/self-review.ts', '../escape']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid task id/);
});
