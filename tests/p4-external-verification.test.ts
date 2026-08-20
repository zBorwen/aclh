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

function runRuntime(projectRoot: string, script: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_PROJECT_ROOT: projectRoot },
  });
}

function createConsumer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-verification-consumer-'));
  git(root, ['init', '-b', 'agent/external-verification']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.writeFileSync(path.join(root, 'README.md'), '# external verification consumer\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('external consumer uses Engine policy/contracts for structural verification without Engine files in project', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-EXTERNAL-VERIFICATION';
  try {
    const init = runRuntime(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);

    fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId,
      classification: {
        primary: 'feature', traits: ['behavior-change'], confidence: 'high',
        rationale: ['exercise external structural verification'], ambiguities: [], source: 'codex',
      },
    }));
    assert.equal(runRuntime(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);

    fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected: ['task-decomposition'],
    }));
    const resolve = runRuntime(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
    assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);

    const planPath = path.join(taskDir, 'test-plan.md');
    const plan = fs.readFileSync(planPath, 'utf8')
      .replace('- [ ] DOC_STRUCTURE:', '- [x] DOC_STRUCTURE:')
      .replace('- [ ] LINK_OR_EXAMPLE_CHECK:', '- [x] LINK_OR_EXAMPLE_CHECK:');
    fs.writeFileSync(planPath, plan);
    const verification = runRuntime(projectRoot, 'verification-plan.ts', [taskId]);
    assert.equal(verification.status, 0, verification.stderr || verification.stdout);

    fs.writeFileSync(path.join(taskDir, 'task-decomposition.md'), [
      '# Task Slices', '1. External consumer slice.', '',
      '# Acceptance Boundaries', '- Runtime remains external.', '',
      '# Dependencies', '- Consumer depends on Engine only while ACLH is attached.', '',
    ].join('\n'));
    const skillOutput = runRuntime(projectRoot, 'skill-output.ts', [taskId, '--verify']);
    assert.equal(skillOutput.status, 0, skillOutput.stderr || skillOutput.stdout);

    const identity = runRuntime(projectRoot, 'task-identity.ts', [taskId, '--verify']);
    assert.equal(identity.status, 0, identity.stderr || identity.stdout);

    assert.equal(fs.existsSync(path.join(projectRoot, '.harness/scripts')), false);
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness/skills')), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
