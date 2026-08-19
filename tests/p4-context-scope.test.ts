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
function createConsumer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-context-scope-'));
  git(root, ['init', '-b', 'agent/context-scope']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/index.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, 'README.md'), '# scope consumer\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('Context Scope combines business changes with explicit scope while excluding ACLH governance files', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-CONTEXT-SCOPE';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    const statePath = path.join(taskDir, '.state.yaml');
    const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as Record<string, any>;
    state.context_scope = { modules: ['IssueUI'], tags: ['ui'], files: ['README.md'] };
    fs.writeFileSync(statePath, stringifyYaml(state));

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 2;\n');
    fs.writeFileSync(path.join(taskDir, 'notes.md'), '# governance-only note\n');
    fs.mkdirSync(path.join(projectRoot, '.harness/project'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.harness/project/profile.yaml'), 'project:\n  name: Scope Consumer\n');
    fs.mkdirSync(path.join(projectRoot, '.agents/skills/aclh-task'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.agents/skills/aclh-task/SKILL.md'), '# thin integration\n');

    const generate = run(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(generate.status, 0, generate.stderr || generate.stdout);
    const artifact = JSON.parse(fs.readFileSync(path.join(taskDir, 'context-scope.json'), 'utf8')) as {
      scope: { source: string; files: string[]; modules: string[]; tags: string[]; reasons: string[] };
      basis: { changed_files: string[] };
    };
    assert.equal(artifact.scope.source, 'combined');
    assert.deepEqual(artifact.scope.files, ['README.md', 'src/index.ts']);
    assert.deepEqual(artifact.scope.modules, ['IssueUI']);
    assert.deepEqual(artifact.scope.tags, ['ui']);
    assert.deepEqual(artifact.basis.changed_files, ['src/index.ts']);
    assert.equal(artifact.scope.files.some(file => file.startsWith('docs/wip/')), false);
    assert.equal(artifact.scope.files.some(file => file.startsWith('.harness/project/')), false);
    assert.equal(artifact.scope.files.some(file => file.startsWith('.agents/skills/aclh-task/')), false);

    const verify = run(projectRoot, 'context-scope.ts', [taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);

    fs.writeFileSync(path.join(projectRoot, 'src/index.ts'), 'export const value = 3;\n');
    const stale = run(projectRoot, 'context-scope.ts', [taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /context-scope\.json is stale/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('Context Scope can be intentionally empty before business implementation starts', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-EMPTY-SCOPE';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const generate = run(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(generate.status, 0, generate.stderr || generate.stdout);
    const artifact = JSON.parse(fs.readFileSync(path.join(projectRoot, 'docs/wip', taskId, 'context-scope.json'), 'utf8')) as {
      scope: { source: string; files: string[] };
    };
    assert.equal(artifact.scope.source, 'none');
    assert.deepEqual(artifact.scope.files, []);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
