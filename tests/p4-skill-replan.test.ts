import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

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
function createConsumer(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `aclh-replan-${name}-`));
  git(root, ['init', '-b', `agent/${name}`]);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const value = 1;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}
function initializeTask(projectRoot: string, taskId: string): string {
  const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const taskDir = path.join(projectRoot, 'docs/wip', taskId);
  fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
    version: '1.0', task_id: taskId,
    classification: {
      primary: 'feature', traits: ['behavior-change'], confidence: 'high',
      rationale: ['overall Task remains a feature across human handoff'], ambiguities: [], source: 'codex',
    },
  }));
  fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
    version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected: ['regression-verification'],
  }));
  assert.equal(run(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);
  const resolve = run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
  assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
  return taskDir;
}

test('unchanged re-plan must explicitly match the Resync baseline and blocks delivery when missing', () => {
  const projectRoot = createConsumer(`unchanged-${process.pid}`);
  const taskId = 'TASK-REPLAN-UNCHANGED';
  try {
    const taskDir = initializeTask(projectRoot, taskId);
    const classificationBefore = fs.readFileSync(path.join(taskDir, 'classification.yaml'), 'utf8');
    assert.equal(run(projectRoot, 'managed-snapshot.ts', [taskId, '--record']).status, 0);

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 2;\n');
    const resync = run(projectRoot, 'resync.ts', [taskId, '--prepare', '--json']);
    assert.equal(resync.status, 0, resync.stderr || resync.stdout);
    const report = JSON.parse(resync.stdout) as { baseline_skill_plan: { sha256: string; selected: string[] } };
    assert.deepEqual(report.baseline_skill_plan.selected, ['regression-verification']);

    const deliveryBefore = run(projectRoot, 'delivery-gate.ts', [taskId]);
    assert.notEqual(deliveryBefore.status, 0);
    assert.match(deliveryBefore.stdout + deliveryBefore.stderr, /Skill Re-plan checkpoint missing/);

    const wrongDecision = run(projectRoot, 'skill-replan.ts', [taskId, '--record', 'changed', '--source', 'human']);
    assert.notEqual(wrongDecision.status, 0);
    assert.match(wrongDecision.stderr, /decision=changed requires the semantic Skill Plan to differ/);

    const record = run(projectRoot, 'skill-replan.ts', [taskId, '--record', 'unchanged', '--source', 'human']);
    assert.equal(record.status, 0, record.stderr || record.stdout);
    const verify = run(projectRoot, 'skill-replan.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
    assert.match(verify.stdout, /unchanged \(human\)/);
    assert.equal(fs.readFileSync(path.join(taskDir, 'classification.yaml'), 'utf8'), classificationBefore);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('changed re-plan must reflect a real explicit Skill Plan change and becomes stale if the Plan changes again', () => {
  const projectRoot = createConsumer(`changed-${process.pid}`);
  const taskId = 'TASK-REPLAN-CHANGED';
  try {
    const taskDir = initializeTask(projectRoot, taskId);
    const classificationPath = path.join(taskDir, 'classification.yaml');
    const classificationBefore = fs.readFileSync(classificationPath, 'utf8');
    assert.equal(run(projectRoot, 'managed-snapshot.ts', [taskId, '--record']).status, 0);

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 3;\n');
    const resync = run(projectRoot, 'resync.ts', [taskId, '--prepare']);
    assert.equal(resync.status, 0, resync.stderr || resync.stdout);

    fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' },
      selected: ['compatibility-verification', 'regression-verification'],
    }));
    const resolveChanged = run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
    assert.equal(resolveChanged.status, 0, resolveChanged.stderr || resolveChanged.stdout);

    const wrongUnchanged = run(projectRoot, 'skill-replan.ts', [taskId, '--record', 'unchanged', '--source', 'codex']);
    assert.notEqual(wrongUnchanged.status, 0);
    assert.match(wrongUnchanged.stderr, /decision=unchanged requires the semantic Skill Plan to match/);

    const record = run(projectRoot, 'skill-replan.ts', [taskId, '--record', 'changed', '--source', 'codex']);
    assert.equal(record.status, 0, record.stderr || record.stdout);
    const verify = run(projectRoot, 'skill-replan.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
    assert.match(verify.stdout, /changed \(codex\)/);
    assert.equal(fs.readFileSync(classificationPath, 'utf8'), classificationBefore);

    fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected: ['regression-verification'],
    }));
    assert.equal(run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']).status, 0);
    const stale = run(projectRoot, 'skill-replan.ts', [taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /stale for the current Skill Plan/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
