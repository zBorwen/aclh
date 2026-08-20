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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-context-readiness-'));
  git(root, ['init', '-b', branch]);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"readiness-consumer","private":true}\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}
function bootstrap(projectRoot: string, taskId: string, selected: string[], primary: 'feature' | 'bug' = 'feature'): string {
  const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const taskDir = path.join(projectRoot, 'docs/wip', taskId);
  fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
    version: '1.0',
    task_id: taskId,
    classification: {
      primary,
      traits: ['behavior-change'],
      confidence: 'high',
      rationale: ['exercise Context source readiness'],
      ambiguities: [],
      source: 'codex',
    },
  }));
  assert.equal(run(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);
  fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
    version: '1.0',
    task_id: taskId,
    classification: { ref: 'classification.yaml' },
    selected,
  }));
  const resolve = run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
  assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
  return taskDir;
}

test('required profile and architecture placeholders are present-but-unusable until real project Context exists', () => {
  const projectRoot = createConsumer('agent/readiness-required');
  const taskId = 'TASK-READINESS-REQUIRED';
  try {
    const taskDir = bootstrap(projectRoot, taskId, ['task-decomposition']);
    const projectDir = path.join(projectRoot, '.harness/project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'profile.yaml'), stringifyYaml({ project: { name: '' } }));
    fs.writeFileSync(path.join(projectDir, 'architecture.yaml'), stringifyYaml({ modules: [], boundaries: { rules: [], dependency_direction: [] } }));

    const reportResult = run(projectRoot, 'context-readiness.ts', [taskId, '--json']);
    assert.equal(reportResult.status, 0, reportResult.stderr || reportResult.stdout);
    const report = JSON.parse(reportResult.stdout) as {
      ready: boolean;
      blockers: string[];
      sources: Array<{ id: string; level: string; status: string }>;
    };
    assert.equal(report.ready, false);
    assert.deepEqual(report.blockers, ['architecture', 'project-profile']);
    assert.equal(report.sources.find(item => item.id === 'project-profile')?.status, 'present-but-unusable');
    assert.equal(report.sources.find(item => item.id === 'architecture')?.status, 'present-but-unusable');
    assert.equal(report.sources.find(item => item.id === 'decisions')?.status, 'missing');
    assert.equal(report.sources.find(item => item.id === 'decisions')?.level, 'optional');

    const verifyBlocked = run(projectRoot, 'context-readiness.ts', [taskId, '--verify']);
    assert.notEqual(verifyBlocked.status, 0);

    const scope = run(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(scope.status, 0, scope.stderr || scope.stdout);
    const contextBlocked = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.notEqual(contextBlocked.status, 0);
    assert.match(contextBlocked.stderr, /required Context capability (architecture|project-profile) source present-but-unusable/);

    fs.writeFileSync(path.join(projectDir, 'profile.yaml'), stringifyYaml({
      project: { name: 'Readiness Consumer', type: 'frontend', maturity: 'existing' },
      tech_stack: { language: 'TypeScript' },
    }));
    fs.writeFileSync(path.join(projectDir, 'architecture.yaml'), stringifyYaml({
      modules: [{ name: 'App', path: 'src', responsibility: 'consumer app', depends_on: [] }],
      boundaries: { rules: [], dependency_direction: [] },
    }));

    const verifyReady = run(projectRoot, 'context-readiness.ts', [taskId, '--verify']);
    assert.equal(verifyReady.status, 0, verifyReady.stderr || verifyReady.stdout);
    const staleScope = run(projectRoot, 'context-scope.ts', [taskId, '--verify']);
    assert.notEqual(staleScope.status, 0, 'architecture readiness changes must invalidate Scope');
    assert.equal(run(projectRoot, 'context-scope.ts', [taskId, '--generate']).status, 0);

    const context = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(context.status, 0, context.stderr || context.stdout);
    const parsed = JSON.parse(fs.readFileSync(path.join(taskDir, 'context.json'), 'utf8')) as {
      selected: Record<string, { available?: boolean; readiness?: string }>;
    };
    assert.equal(parsed.selected.decisions?.available, false);
    assert.equal(parsed.selected.decisions?.readiness, 'missing');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('an empty knowledge ledger is ready while missing optional knowledge does not block Context', () => {
  const projectRoot = createConsumer('agent/readiness-knowledge');
  const taskId = 'TASK-READINESS-KNOWLEDGE';
  try {
    bootstrap(projectRoot, taskId, ['root-cause-analysis'], 'bug');
    const projectDir = path.join(projectRoot, '.harness/project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'bug-ledger.yaml'), stringifyYaml({ entries: [] }));
    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 2;\n');

    const reportResult = run(projectRoot, 'context-readiness.ts', [taskId, '--verify', '--json']);
    assert.equal(reportResult.status, 0, reportResult.stderr || reportResult.stdout);
    const report = JSON.parse(reportResult.stdout) as {
      ready: boolean;
      blockers: string[];
      sources: Array<{ id: string; level: string; status: string }>;
    };
    assert.equal(report.ready, true);
    assert.deepEqual(report.blockers, []);
    assert.equal(report.sources.find(item => item.id === 'bug-ledger')?.status, 'ready');
    assert.equal(report.sources.find(item => item.id === 'architecture')?.status, 'missing');
    assert.equal(report.sources.find(item => item.id === 'architecture')?.level, 'optional');
    assert.equal(report.sources.find(item => item.id === 'gotchas')?.status, 'missing');

    const scope = run(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(scope.status, 0, scope.stderr || scope.stdout);
    const context = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(context.status, 0, context.stderr || context.stdout);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
