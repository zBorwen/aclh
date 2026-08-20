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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-context-consumer-'));
  git(root, ['init', '-b', 'agent/external-context']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const answer = 42;\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"external-context-consumer","private":true}\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

function bootstrap(projectRoot: string, taskId: string): void {
  const init = runRuntime(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const taskDir = path.join(projectRoot, 'docs/wip', taskId);
  fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
    version: '1.0',
    task_id: taskId,
    classification: {
      primary: 'feature',
      traits: ['behavior-change'],
      confidence: 'high',
      rationale: ['exercise external Context ownership'],
      ambiguities: [],
      source: 'codex',
    },
  }));
  assert.equal(runRuntime(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);
  fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
    version: '1.0',
    task_id: taskId,
    classification: { ref: 'classification.yaml' },
    selected: ['task-decomposition'],
  }));
  const resolve = runRuntime(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
  assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
}

function writeProjectContext(projectRoot: string): void {
  const projectDir = path.join(projectRoot, '.harness/project');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'profile.yaml'), stringifyYaml({
    project: { name: 'External Consumer', type: 'frontend', maturity: 'existing' },
    tech_stack: { language: 'TypeScript' },
  }));
  fs.writeFileSync(path.join(projectDir, 'architecture.yaml'), stringifyYaml({
    modules: [{ name: 'App', path: 'src', responsibility: 'consumer source', depends_on: [] }],
    boundaries: { rules: [], dependency_direction: [] },
  }));
}

test('Skill-aware Context reads project state from consumer and contracts from external Engine', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-EXTERNAL-CONTEXT';
  try {
    bootstrap(projectRoot, taskId);
    writeProjectContext(projectRoot);

    const scopeGenerate = runRuntime(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(scopeGenerate.status, 0, scopeGenerate.stderr || scopeGenerate.stdout);
    assert.equal(runRuntime(projectRoot, 'context-scope.ts', [taskId, '--verify']).status, 0);

    const generate = runRuntime(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(generate.status, 0, generate.stderr || generate.stdout);
    const contextPath = path.join(projectRoot, 'docs/wip', taskId, 'context.json');
    const context = JSON.parse(fs.readFileSync(contextPath, 'utf8')) as {
      version: string;
      selected: Record<string, { source?: string }>;
      basis: { changed_files: string[]; resolved_scope?: { modules?: string[] } };
    };
    assert.equal(context.version, '2.0');
    assert.equal(context.selected['project-profile']?.source, '.harness/project/profile.yaml');
    assert.equal(context.selected.architecture?.source, '.harness/project/architecture.yaml');
    assert.deepEqual(context.basis.resolved_scope?.modules, []);
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness/scripts')), false);
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness/skills')), false);

    const verify = runRuntime(projectRoot, 'context-select.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const answer = 43;\n');
    const staleScope = runRuntime(projectRoot, 'context-scope.ts', [taskId, '--verify']);
    assert.notEqual(staleScope.status, 0);
    const stale = runRuntime(projectRoot, 'context-select.ts', [taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Context Scope invalid or stale/);

    const scopeRefresh = runRuntime(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(scopeRefresh.status, 0, scopeRefresh.stderr || scopeRefresh.stdout);
    const refresh = runRuntime(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(refresh.status, 0, refresh.stderr || refresh.stdout);
    assert.equal(runRuntime(projectRoot, 'context-select.ts', [taskId, '--verify']).status, 0);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
