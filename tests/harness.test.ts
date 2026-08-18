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
    checks: Array<Record<string, unknown>>;
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

test('init-task creates an empty v1.1 evidence record', () => {
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
    assert.equal(evidence.version, '1.1');
    assert.equal(evidence.task_id, taskId);
    assert.equal(evidence.updated_at, null);
    assert.deepEqual(evidence.gates, {});
  } finally {
    fs.rmSync(taskDir, { recursive: true, force: true });
  }
});

test('evidence recorder binds a real gate to the current repository snapshot', () => {
  const taskId = `TEST-EVIDENCE-GATE-${process.pid}`;
  const taskDir = path.join('docs/wip', taskId);
  fs.rmSync(taskDir, { recursive: true, force: true });

  try {
    const init = run(['.harness/scripts/init-task.ts', taskId]);
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const record = run(['.harness/scripts/evidence.ts', taskId, '--gate', 'check']);
    assert.equal(record.status, 0, record.stderr || record.stdout);

    const evidence = JSON.parse(fs.readFileSync(path.join(taskDir, 'evidence.json'), 'utf8')) as {
      version: string;
      gates: Record<string, {
        command: string;
        exit_code: number;
        result: string;
        repository_unchanged: boolean;
        repository: { commit_sha: string; worktree_sha256: string };
      }>;
    };
    assert.equal(evidence.version, '1.1');
    assert.equal(evidence.gates.check.command, 'npm run check');
    assert.equal(evidence.gates.check.exit_code, 0);
    assert.equal(evidence.gates.check.result, 'PASS');
    assert.equal(evidence.gates.check.repository_unchanged, true);
    assert.match(evidence.gates.check.repository.commit_sha, /^[0-9a-f]{40}$/);
    assert.match(evidence.gates.check.repository.worktree_sha256, /^[0-9a-f]{64}$/);

    const verify = run(['.harness/scripts/evidence.ts', taskId, '--verify']);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stdout, /check: fresh PASS evidence present/);
    assert.match(verify.stderr, /typecheck: missing or failing evidence/);
    assert.match(verify.stderr, /test: missing or failing evidence/);
  } finally {
    fs.rmSync(taskDir, { recursive: true, force: true });
  }
});

test('evidence becomes stale when repository content changes after a gate', () => {
  const taskId = `TEST-EVIDENCE-STALE-${process.pid}`;
  const taskDir = path.join('docs/wip', taskId);
  fs.rmSync(taskDir, { recursive: true, force: true });

  try {
    const init = run(['.harness/scripts/init-task.ts', taskId]);
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const record = run(['.harness/scripts/evidence.ts', taskId, '--gate', 'check']);
    assert.equal(record.status, 0, record.stderr || record.stdout);

    fs.appendFileSync(path.join(taskDir, 'changelog.md'), '- changed after evidence\n');

    const verify = run(['.harness/scripts/evidence.ts', taskId, '--verify']);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /check: stale evidence; repository changed after gate execution/);
  } finally {
    fs.rmSync(taskDir, { recursive: true, force: true });
  }
});

test('v1.0 evidence cannot be reused as fresh v1.1 evidence', () => {
  const taskId = `TEST-EVIDENCE-MIGRATION-${process.pid}`;
  const taskDir = path.join('docs/wip', taskId);
  fs.rmSync(taskDir, { recursive: true, force: true });

  try {
    const init = run(['.harness/scripts/init-task.ts', taskId]);
    assert.equal(init.status, 0, init.stderr || init.stdout);

    fs.writeFileSync(
      path.join(taskDir, 'evidence.json'),
      `${JSON.stringify({
        version: '1.0',
        task_id: taskId,
        updated_at: new Date().toISOString(),
        gates: {
          check: {
            gate: 'check',
            command: 'npm run check',
            started_at: '2026-08-19T00:00:00.000Z',
            finished_at: '2026-08-19T00:00:01.000Z',
            exit_code: 0,
            result: 'PASS',
          },
        },
      }, null, 2)}\n`,
    );

    const verify = run(['.harness/scripts/evidence.ts', taskId, '--verify']);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /v1\.0 evidence is stale by definition/);
    assert.match(verify.stderr, /check: missing or failing evidence/);
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
