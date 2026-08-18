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

test('check exposes the enforcement contract and keeps delegated checks non-blocking', () => {
  const result = run(['.harness/scripts/check.ts', '--format', 'json']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    enforcement_policy: Record<string, string>;
    findings: Array<{ check_id: string; enforcement: string }>;
    summary: { blocking_failed: number; config_errors: number; info: number };
  };

  assert.equal(report.enforcement_policy.blocking, 'machine-verified; violation blocks');
  assert.equal(report.summary.blocking_failed, 0);
  assert.equal(report.summary.config_errors, 0);
  assert.ok(report.summary.info > 0);

  const delegated = report.findings.find(item => item.check_id === 'ts-typecheck');
  assert.equal(delegated?.enforcement, 'verifiable');
});

test('active executable checks declare an explicit enforcement level', () => {
  const result = run(['.harness/scripts/check.ts', '--format', 'json']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    summary: { config_errors: number };
  };

  assert.equal(report.summary.config_errors, 0);
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
