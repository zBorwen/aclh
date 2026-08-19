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
function createConsumer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-resync-'));
  git(root, ['init', '-b', 'agent/resync']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({
    name: 'resync-consumer',
    private: true,
    scripts: { test: 'node -e "process.exit(0)"' },
  }, null, 2)}\n`);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('resync reports the current task change set and required refreshes without changing Task classification', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-RESYNC';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    const classificationPath = path.join(taskDir, 'classification.yaml');
    fs.writeFileSync(classificationPath, stringifyYaml({
      version: '1.0', task_id: taskId,
      classification: {
        primary: 'feature', traits: ['behavior-change'], confidence: 'high',
        rationale: ['feature classification must survive human handoff'], ambiguities: [], source: 'codex',
      },
    }));
    fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected: ['regression-verification'],
    }));
    assert.equal(run(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);
    const resolve = run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
    assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
    const context = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(context.status, 0, context.stderr || context.stdout);
    const evidence = run(projectRoot, 'evidence.ts', [taskId, '--gate', 'test']);
    assert.equal(evidence.status, 0, evidence.stderr || evidence.stdout);
    const managed = run(projectRoot, 'managed-snapshot.ts', [taskId, '--record']);
    assert.equal(managed.status, 0, managed.stderr || managed.stdout);

    const classificationBefore = fs.readFileSync(classificationPath, 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 2;\n');
    const statusBefore = git(projectRoot, ['status', '--short']);
    const resync = run(projectRoot, 'resync.ts', [taskId, '--prepare', '--json']);
    assert.equal(resync.status, 0, resync.stderr || resync.stdout);
    const report = JSON.parse(resync.stdout) as {
      status: string;
      changes: { current_task_change_set: string[]; current_worktree_files: string[] };
      requirements: {
        preserve_classification: boolean;
        skill_plan_review: boolean;
        context_refresh: boolean;
        evidence_refresh: boolean;
      };
    };
    assert.equal(report.status, 'changed');
    assert.ok(report.changes.current_task_change_set.includes('src/index.ts'));
    assert.ok(report.changes.current_worktree_files.includes('src/index.ts'));
    assert.equal(report.requirements.preserve_classification, true);
    assert.equal(report.requirements.skill_plan_review, true);
    assert.equal(report.requirements.context_refresh, true);
    assert.equal(report.requirements.evidence_refresh, true);
    assert.equal(fs.readFileSync(classificationPath, 'utf8'), classificationBefore);
    assert.equal(git(projectRoot, ['status', '--short']), statusBefore, 'Git-local resync report must not change project diff');

    const staleContext = run(projectRoot, 'context-select.ts', [taskId, '--verify']);
    assert.notEqual(staleContext.status, 0, 'prepare must not silently refresh Context');

    const reportGitPath = git(projectRoot, ['rev-parse', '--git-path', `aclh/resync/${taskId}.json`]);
    const reportPath = path.isAbsolute(reportGitPath) ? reportGitPath : path.resolve(projectRoot, reportGitPath);
    assert.equal(fs.existsSync(reportPath), true);

    assert.equal(run(projectRoot, 'managed-snapshot.ts', [taskId, '--record']).status, 0);
    const clean = run(projectRoot, 'resync.ts', [taskId, '--prepare', '--json']);
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);
    assert.equal(JSON.parse(clean.stdout).status, 'clean');
    assert.equal(fs.existsSync(reportPath), false, 'clean resync clears the previous changed report');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
