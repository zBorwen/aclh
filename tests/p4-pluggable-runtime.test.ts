import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { stringify as stringifyYaml } from 'yaml';

const ENGINE_ROOT = process.cwd();

function git(root: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function createConsumer(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `aclh-${name}-`));
  git(root, ['init', '-b', `agent/${name}`]);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.writeFileSync(path.join(root, 'README.md'), `# ${name}\n`);
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ name, private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
  git(root, ['add', 'README.md', 'package.json']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

function runRuntime(projectRoot: string, script: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_PROJECT_ROOT: projectRoot },
  });
}

function writeClassification(projectRoot: string, taskId: string): void {
  const taskDir = path.join(projectRoot, 'docs/wip', taskId);
  fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
    version: '1.0',
    task_id: taskId,
    classification: {
      primary: 'feature',
      traits: ['behavior-change'],
      confidence: 'high',
      rationale: ['consumer fixture exercises an external ACLH Engine'],
      ambiguities: [],
      source: 'codex',
    },
  }));
}

function writeSkillPlan(projectRoot: string, taskId: string): void {
  const taskDir = path.join(projectRoot, 'docs/wip', taskId);
  fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
    version: '1.0',
    task_id: taskId,
    classification: { ref: 'classification.yaml' },
    selected: ['task-decomposition'],
  }));
}

function bootstrapConsumer(projectRoot: string, taskId: string): void {
  const init = runRuntime(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs/wip', taskId, '.state.yaml')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.harness')), false, 'Engine implementation must not be copied into the consumer');

  writeClassification(projectRoot, taskId);
  const classification = runRuntime(projectRoot, 'classification.ts', [taskId, '--verify']);
  assert.equal(classification.status, 0, classification.stderr || classification.stdout);

  writeSkillPlan(projectRoot, taskId);
  const resolve = runRuntime(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
  assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
  const verify = runRuntime(projectRoot, 'skill-plan.ts', [taskId, '--verify']);
  assert.equal(verify.status, 0, verify.stderr || verify.stdout);
}

test('external ACLH Engine bootstraps governed state in an independent consumer repo', () => {
  const projectRoot = createConsumer(`consumer-${process.pid}`);
  try {
    bootstrapConsumer(projectRoot, 'TASK-EXTERNAL-ENGINE');
    assert.equal(fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8').startsWith('# consumer-'), true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('one ACLH Engine can govern two independent consumer repositories', () => {
  const first = createConsumer(`consumer-a-${process.pid}`);
  const second = createConsumer(`consumer-b-${process.pid}`);
  try {
    bootstrapConsumer(first, 'TASK-CONSUMER-A');
    bootstrapConsumer(second, 'TASK-CONSUMER-B');
    assert.notEqual(first, second);
    assert.equal(fs.existsSync(path.join(first, 'docs/wip/TASK-CONSUMER-B')), false);
    assert.equal(fs.existsSync(path.join(second, 'docs/wip/TASK-CONSUMER-A')), false);
  } finally {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
});
