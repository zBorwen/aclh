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
function run(projectRoot: string, script: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_PROJECT_ROOT: projectRoot },
  });
}
function createConsumer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-skill-evidence-'));
  git(root, ['init', '-b', 'agent/external-skill-evidence']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const stable = true;\n');
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ name: 'skill-evidence-consumer', private: true, scripts: { test: 'node -e "process.exit(0)"' } }, null, 2)}\n`);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('verification Skill accepts fresh consumer Evidence and rejects it after consumer change', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-EXTERNAL-SKILL-EVIDENCE';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId,
      classification: { primary: 'bug', traits: ['behavior-change'], confidence: 'high', rationale: ['verify a regression Skill externally'], ambiguities: [], source: 'codex' },
    }));
    fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected: ['regression-verification'],
    }));
    assert.equal(run(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);
    const resolve = run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
    assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);

    const testEvidence = run(projectRoot, 'evidence.ts', [taskId, '--gate', 'test']);
    assert.equal(testEvidence.status, 0, testEvidence.stderr || testEvidence.stdout);
    const verify = run(projectRoot, 'skill-evidence.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const stable = false;\n');
    const stale = run(projectRoot, 'skill-evidence.ts', [taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /stale evidence/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
