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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-context-bootstrap-'));
  git(root, ['init', '-b', branch]);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"bootstrap-consumer","private":true}\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}
function bootstrapTask(projectRoot: string, taskId: string, selected: string[], primary: 'feature' | 'bug' = 'feature'): string {
  const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const taskDir = path.join(projectRoot, 'docs/wip', taskId);
  fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
    version: '1.0', task_id: taskId,
    classification: {
      primary, traits: ['behavior-change'], confidence: 'high',
      rationale: ['exercise project Context bootstrap'], ambiguities: [], source: 'codex',
    },
  }));
  assert.equal(run(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);
  fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
    version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected,
  }));
  const resolve = run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
  assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
  return taskDir;
}

test('Runtime plans semantic Context authoring but never overwrites profile or architecture', () => {
  const projectRoot = createConsumer('agent/context-bootstrap-semantic');
  const taskId = 'TASK-BOOTSTRAP-SEMANTIC';
  try {
    bootstrapTask(projectRoot, taskId, ['task-decomposition']);
    const projectDir = path.join(projectRoot, '.harness/project');
    fs.mkdirSync(projectDir, { recursive: true });
    const profilePath = path.join(projectDir, 'profile.yaml');
    const architecturePath = path.join(projectDir, 'architecture.yaml');
    const profilePlaceholder = 'project:\n  name: ""\n';
    const architecturePlaceholder = 'modules: []\nboundaries:\n  rules: []\n  dependency_direction: []\n';
    fs.writeFileSync(profilePath, profilePlaceholder);
    fs.writeFileSync(architecturePath, architecturePlaceholder);

    const prepare = run(projectRoot, 'context-bootstrap.ts', [taskId, '--prepare', '--json']);
    assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
    const result = JSON.parse(prepare.stdout) as {
      actions: Array<{ id: string; kind: string; safe_automatic: boolean }>;
      initialized: string[];
      semantic_authoring_required: string[];
    };
    assert.deepEqual(result.semantic_authoring_required, ['architecture', 'project-profile']);
    assert.deepEqual(result.initialized, []);
    assert.equal(result.actions.every(action => action.kind === 'author-semantic-context' && action.safe_automatic === false), true);
    assert.equal(fs.readFileSync(profilePath, 'utf8'), profilePlaceholder, 'Runtime must not overwrite semantic profile Context');
    assert.equal(fs.readFileSync(architecturePath, 'utf8'), architecturePlaceholder, 'Runtime must not overwrite semantic architecture Context');

    fs.writeFileSync(profilePath, stringifyYaml({
      project: { name: 'Bootstrap Consumer', type: 'frontend', maturity: 'existing' },
      tech_stack: { language: 'TypeScript' },
    }));
    fs.writeFileSync(architecturePath, stringifyYaml({
      modules: [{ name: 'App', path: 'src', responsibility: 'application source', depends_on: [] }],
      boundaries: { rules: [], dependency_direction: [] },
    }));

    const readiness = run(projectRoot, 'context-readiness.ts', [taskId, '--verify']);
    assert.equal(readiness.status, 0, readiness.stderr || readiness.stdout);
    assert.equal(run(projectRoot, 'context-scope.ts', [taskId, '--generate']).status, 0);
    const context = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(context.status, 0, context.stderr || context.stdout);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('Runtime safely initializes a missing required knowledge ledger and is idempotent', () => {
  const projectRoot = createConsumer('agent/context-bootstrap-ledger');
  const taskId = 'TASK-BOOTSTRAP-LEDGER';
  try {
    bootstrapTask(projectRoot, taskId, ['root-cause-analysis'], 'bug');
    const bugLedgerPath = path.join(projectRoot, '.harness/project/bug-ledger.yaml');
    assert.equal(fs.existsSync(bugLedgerPath), false);

    const plan = run(projectRoot, 'context-bootstrap.ts', [taskId, '--plan', '--json']);
    assert.equal(plan.status, 0, plan.stderr || plan.stdout);
    const planned = JSON.parse(plan.stdout) as { actions: Array<{ id: string; kind: string; safe_automatic: boolean }> };
    assert.deepEqual(planned.actions.map(action => action.id), ['bug-ledger']);
    assert.equal(planned.actions[0]?.kind, 'initialize-empty-ledger');
    assert.equal(planned.actions[0]?.safe_automatic, true);

    const prepare = run(projectRoot, 'context-bootstrap.ts', [taskId, '--prepare', '--json']);
    assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
    assert.deepEqual((JSON.parse(prepare.stdout) as { initialized: string[] }).initialized, ['bug-ledger']);
    assert.equal(fs.readFileSync(bugLedgerPath, 'utf8'), 'entries: []\n');

    const second = run(projectRoot, 'context-bootstrap.ts', [taskId, '--prepare', '--json']);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const secondResult = JSON.parse(second.stdout) as { actions: unknown[]; initialized: string[] };
    assert.deepEqual(secondResult.actions, []);
    assert.deepEqual(secondResult.initialized, []);
    assert.equal(fs.readFileSync(bugLedgerPath, 'utf8'), 'entries: []\n');

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 2;\n');
    const readiness = run(projectRoot, 'context-readiness.ts', [taskId, '--verify']);
    assert.equal(readiness.status, 0, readiness.stderr || readiness.stdout);
    assert.equal(run(projectRoot, 'context-scope.ts', [taskId, '--generate']).status, 0);
    const context = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(context.status, 0, context.stderr || context.stdout);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
