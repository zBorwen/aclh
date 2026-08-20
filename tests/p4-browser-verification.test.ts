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
function createConsumer(name: string, browserScript?: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `aclh-browser-${name}-`));
  git(root, ['init', '-b', `agent/${name}`]);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({
    name: `browser-${name}`,
    private: true,
    scripts: browserScript ? { 'test:browser': browserScript } : {},
  }, null, 2)}\n`);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}
function initTask(projectRoot: string, taskId: string): string {
  const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  return path.join(projectRoot, 'docs/wip', taskId);
}

test('browser machine coverage requires a fresh consumer test:browser proof', () => {
  const projectRoot = createConsumer(`proof-${process.pid}`, 'node -e "process.exit(0)"');
  const taskId = 'TASK-BROWSER-PROOF';
  try {
    const taskDir = initTask(projectRoot, taskId);
    fs.writeFileSync(path.join(taskDir, 'verification-gaps.yaml'), stringifyYaml({
      version: '1.1', task_id: taskId,
      assessment: { source: 'codex', summary: 'Browser interaction requires the consumer browser verifier.' },
      entries: [{
        id: 'browser-interaction', dimension: 'browser-interaction',
        description: 'Exercise the browser interaction path.', status: 'machine-covered',
        machine_proofs: ['browser'],
      }],
    }));

    const check = run(projectRoot, 'verification-gaps.ts', [taskId, '--check']);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    const missing = run(projectRoot, 'verification-gaps.ts', [taskId, '--verify']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /fresh browser verification proof; status=missing/);

    const browserRun = run(projectRoot, 'browser-verification.ts', [taskId, '--run']);
    assert.equal(browserRun.status, 0, browserRun.stderr || browserRun.stdout);
    assert.equal(run(projectRoot, 'browser-verification.ts', [taskId, '--verify']).status, 0);
    const gapVerify = run(projectRoot, 'verification-gaps.ts', [taskId, '--verify']);
    assert.equal(gapVerify.status, 0, gapVerify.stderr || gapVerify.stdout);

    const record = JSON.parse(fs.readFileSync(path.join(taskDir, 'browser-verification.json'), 'utf8')) as {
      provider: string; npm_script: string; command: string; result: string; repository_unchanged: boolean;
    };
    assert.equal(record.provider, 'npm-script');
    assert.equal(record.npm_script, 'test:browser');
    assert.equal(record.command, 'npm run test:browser');
    assert.equal(record.result, 'PASS');
    assert.equal(record.repository_unchanged, true);

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 2;\n');
    const staleDirect = run(projectRoot, 'browser-verification.ts', [taskId, '--verify']);
    assert.notEqual(staleDirect.status, 0);
    assert.match(staleDirect.stderr, /proof is stale/);
    const staleGap = run(projectRoot, 'verification-gaps.ts', [taskId, '--verify']);
    assert.notEqual(staleGap.status, 0);
    assert.match(staleGap.stderr, /fresh browser verification proof; status=stale/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('browser verification is unavailable when consumer does not provide test:browser', () => {
  const projectRoot = createConsumer(`missing-${process.pid}`);
  const taskId = 'TASK-BROWSER-MISSING';
  try {
    initTask(projectRoot, taskId);
    const result = run(projectRoot, 'browser-verification.ts', [taskId, '--run']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /script "test:browser" is missing/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('browser verification records FAIL when the verifier mutates governed repository content', () => {
  const projectRoot = createConsumer(
    `mutates-${process.pid}`,
    'node -e "require(\'fs\').writeFileSync(\'browser-output.txt\', \'generated\')"',
  );
  const taskId = 'TASK-BROWSER-MUTATION';
  try {
    const taskDir = initTask(projectRoot, taskId);
    const result = run(projectRoot, 'browser-verification.ts', [taskId, '--run']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /repository changed while browser verification was running/);
    const record = JSON.parse(fs.readFileSync(path.join(taskDir, 'browser-verification.json'), 'utf8')) as {
      result: string; repository_unchanged: boolean;
    };
    assert.equal(record.result, 'FAIL');
    assert.equal(record.repository_unchanged, false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
