import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';

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

test('minimal TypeScript baseline blocks ts-ignore but keeps lint-dependent rules verifiable', () => {
  const plugin = parseYaml(
    fs.readFileSync('.harness/plugins/rules/typescript-strict.yaml', 'utf8'),
  ) as {
    checks: Array<{ id: string; type: string; enforcement: string }>;
  };

  const noIgnore = plugin.checks.find(check => check.id === 'ts-no-ignore');
  const noAny = plugin.checks.find(check => check.id === 'ts-no-explicit-any');

  assert.deepEqual(noIgnore, {
    id: 'ts-no-ignore',
    type: 'grep-pattern',
    enforcement: 'blocking',
    severity: 'error',
    description: '禁止使用 @ts-ignore；如确需抑制错误，使用带说明的 @ts-expect-error',
    target: 'src/**/*.{ts,tsx}',
    pattern: '@ts-ignore',
  });
  assert.equal(noAny?.enforcement, 'verifiable');
});

test('init-task creates an empty v1 evidence record', () => {
  const taskId = `TEST-EVIDENCE-INIT-${process.pid}`;
  const taskDir = path.join('docs/wip', taskId);
  fs.rmSync(taskDir, { recursive: true, force: true });

  try {
    const result = run(['.harness/scripts/init-task.ts', taskId]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const evidence = JSON.parse(fs.readFileSync(path.join(taskDir, 'evidence.json'), 'utf8')) as {
      version: string;
      task_id: string;
      updated_at: null;
      gates: Record<string, unknown>;
    };
    assert.equal(evidence.version, '1.0');
    assert.equal(evidence.task_id, taskId);
    assert.equal(evidence.updated_at, null);
    assert.deepEqual(evidence.gates, {});
  } finally {
    fs.rmSync(taskDir, { recursive: true, force: true });
  }
});

test('evidence recorder captures a real gate and verify rejects incomplete evidence', () => {
  const taskId = `TEST-EVIDENCE-GATE-${process.pid}`;
  const taskDir = path.join('docs/wip', taskId);
  fs.rmSync(taskDir, { recursive: true, force: true });

  try {
    const init = run(['.harness/scripts/init-task.ts', taskId]);
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const record = run(['.harness/scripts/evidence.ts', taskId, '--gate', 'check']);
    assert.equal(record.status, 0, record.stderr || record.stdout);

    const evidence = JSON.parse(fs.readFileSync(path.join(taskDir, 'evidence.json'), 'utf8')) as {
      gates: Record<string, { command: string; exit_code: number; result: string }>;
    };
    assert.equal(evidence.gates.check.command, 'npm run check');
    assert.equal(evidence.gates.check.exit_code, 0);
    assert.equal(evidence.gates.check.result, 'PASS');

    const verify = run(['.harness/scripts/evidence.ts', taskId, '--verify']);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /typecheck: missing or failing evidence/);
    assert.match(verify.stderr, /test: missing or failing evidence/);
  } finally {
    fs.rmSync(taskDir, { recursive: true, force: true });
  }
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
