import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const ENGINE_ROOT = process.cwd();

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function runRuntime(projectRoot: string, script: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_PROJECT_ROOT: projectRoot },
  });
}

function createConsumer(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `aclh-evidence-${name}-`));
  git(root, ['init', '-b', `agent/${name}`]);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({
    name,
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

test('external ACLH check evaluates consumer source with Engine-owned rules', () => {
  const projectRoot = createConsumer(`check-${process.pid}`);
  try {
    fs.writeFileSync(path.join(projectRoot, 'src/bad.ts'), '// @ts-ignore\nexport const bad = unknownValue;\n');
    const result = runRuntime(projectRoot, 'check.ts', []);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /ts-ignore/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('external Evidence runs Engine check plus consumer typecheck/test and binds the consumer snapshot', () => {
  const projectRoot = createConsumer(`gates-${process.pid}`);
  const taskId = 'TASK-EXTERNAL-EVIDENCE';
  try {
    const init = runRuntime(projectRoot, 'init-task.ts', [taskId, '--risk', 'L1', '--strategy', 'tdd']);
    assert.equal(init.status, 0, init.stderr || init.stdout);

    for (const gate of ['check', 'typecheck', 'test']) {
      const result = runRuntime(projectRoot, 'evidence.ts', [taskId, '--gate', gate]);
      assert.equal(result.status, 0, `${gate}: ${result.stderr || result.stdout}`);
    }

    const evidencePath = path.join(projectRoot, 'docs/wip', taskId, 'evidence.json');
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as {
      gates: Record<string, { command: string; repository: { commit_sha: string } }>;
    };
    assert.equal(evidence.gates.typecheck.command, 'npm run typecheck');
    assert.equal(evidence.gates.test.command, 'npm test');
    assert.match(evidence.gates.check.command, /\.harness\/scripts\/check\.ts$/);
    assert.equal(evidence.gates.check.repository.commit_sha, git(projectRoot, ['rev-parse', 'HEAD']));

    const verify = runRuntime(projectRoot, 'evidence.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 2;\n');
    const stale = runRuntime(projectRoot, 'evidence.ts', [taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /stale evidence/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
