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
function createConsumer(branch: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-verification-gaps-'));
  git(root, ['init', '-b', branch]);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const value = 1;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}
function initTask(projectRoot: string, taskId: string): string {
  const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  return path.join(projectRoot, 'docs/wip', taskId);
}
function writeRegistry(taskDir: string, value: unknown): void {
  fs.writeFileSync(path.join(taskDir, 'verification-gaps.yaml'), stringifyYaml(value));
}

test('uncovered verification dimensions block registry completion', () => {
  const projectRoot = createConsumer('agent/gaps-uncovered');
  const taskId = 'TASK-GAPS-UNCOVERED';
  try {
    const taskDir = initTask(projectRoot, taskId);
    writeRegistry(taskDir, {
      version: '1.0', task_id: taskId,
      assessment: { source: 'codex', summary: 'Browser interaction is not covered yet.' },
      entries: [{
        id: 'browser-interaction', dimension: 'browser-interaction',
        description: 'Verify the real browser interaction path.', status: 'uncovered',
        notes: 'No browser-capable verification has been performed.',
      }],
    });
    const check = run(projectRoot, 'verification-gaps.ts', [taskId, '--check']);
    assert.notEqual(check.status, 0);
    assert.match(check.stderr, /browser-interaction is uncovered/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('machine-covered gaps require fresh canonical Evidence and become stale after repository change', () => {
  const projectRoot = createConsumer('agent/gaps-machine');
  const taskId = 'TASK-GAPS-MACHINE';
  try {
    const taskDir = initTask(projectRoot, taskId);
    writeRegistry(taskDir, {
      version: '1.0', task_id: taskId,
      assessment: { source: 'codex', summary: 'Deterministic source policy is covered by the canonical check gate.' },
      entries: [{
        id: 'source-policy', dimension: 'architecture-boundary',
        description: 'Verify deterministic source policy checks.', status: 'machine-covered',
        machine_gates: ['check'],
      }],
    });

    const structural = run(projectRoot, 'verification-gaps.ts', [taskId, '--check']);
    assert.equal(structural.status, 0, structural.stderr || structural.stdout);
    const missing = run(projectRoot, 'verification-gaps.ts', [taskId, '--verify']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /fresh canonical check Evidence; status=missing/);

    const evidence = run(projectRoot, 'evidence.ts', [taskId, '--gate', 'check']);
    assert.equal(evidence.status, 0, evidence.stderr || evidence.stdout);
    const verify = run(projectRoot, 'verification-gaps.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 2;\n');
    const stale = run(projectRoot, 'verification-gaps.ts', [taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /fresh canonical check Evidence; status=stale/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('human-covered gaps require explicit human provenance and concrete check details', () => {
  const projectRoot = createConsumer('agent/gaps-human');
  const taskId = 'TASK-GAPS-HUMAN';
  try {
    const taskDir = initTask(projectRoot, taskId);
    const base = {
      version: '1.0', task_id: taskId,
      assessment: { source: 'codex', summary: 'Visual layout requires a human-observed check.' },
    };
    writeRegistry(taskDir, {
      ...base,
      entries: [{
        id: 'visual-layout', dimension: 'visual-layout', description: 'Check layout at the target viewport.', status: 'human-covered',
        human: {
          source: 'codex', checked_by: 'builder', checked_at: new Date().toISOString(),
          procedure: 'Opened the page and inspected layout.', result: 'Looks correct.',
        },
      }],
    });
    const fake = run(projectRoot, 'verification-gaps.ts', [taskId, '--check']);
    assert.notEqual(fake.status, 0);
    assert.match(fake.stderr, /human\.source must be human/);

    writeRegistry(taskDir, {
      ...base,
      entries: [{
        id: 'visual-layout', dimension: 'visual-layout', description: 'Check layout at the target viewport.', status: 'human-covered',
        human: {
          source: 'human', checked_by: 'human-reviewer', checked_at: new Date().toISOString(),
          procedure: 'Opened the page at the target viewport and inspected clipping and overlap.',
          result: 'No clipping or overlap observed.',
        },
      }],
    });
    const check = run(projectRoot, 'verification-gaps.ts', [taskId, '--check']);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    const verify = run(projectRoot, 'verification-gaps.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
