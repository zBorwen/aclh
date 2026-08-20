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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-context-retrieval-'));
  git(root, ['init', '-b', 'agent/context-retrieval']);
  git(root, ['config', 'user.email', 'aclh-test@example.com']);
  git(root, ['config', 'user.name', 'ACLH Test']);
  fs.mkdirSync(path.join(root, 'src/issues/ui'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/billing'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/issues/ui/page.ts'), 'export const issuePage = 1;\n');
  fs.writeFileSync(path.join(root, 'src/billing/index.ts'), 'export const billing = 1;\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"retrieval-consumer","private":true}\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial consumer']);
  return root;
}

test('knowledge retrieval requires Scope relevance before severity ranking and remains bounded by Top-K', () => {
  const projectRoot = createConsumer();
  const taskId = 'TASK-CONTEXT-RETRIEVAL';
  try {
    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const taskDir = path.join(projectRoot, 'docs/wip', taskId);
    fs.writeFileSync(path.join(taskDir, 'classification.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId,
      classification: {
        primary: 'bug', traits: ['behavior-change'], confidence: 'high',
        rationale: ['exercise Scope-bound retrieval'], ambiguities: [], source: 'codex',
      },
    }));
    assert.equal(run(projectRoot, 'classification.ts', [taskId, '--verify']).status, 0);
    fs.writeFileSync(path.join(taskDir, 'skill-plan.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected: ['root-cause-analysis'],
    }));
    const resolve = run(projectRoot, 'skill-plan.ts', [taskId, '--resolve']);
    assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);

    const projectDir = path.join(projectRoot, '.harness/project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'architecture.yaml'), stringifyYaml({
      modules: [
        { name: 'IssueUI', path: 'src/issues/ui', responsibility: 'issue interaction', depends_on: [] },
        { name: 'Billing', path: 'src/billing', responsibility: 'billing', depends_on: [] },
      ],
      boundaries: { rules: [], dependency_direction: [] },
    }));
    fs.writeFileSync(path.join(projectDir, 'bug-ledger.yaml'), stringifyYaml({ entries: [] }));

    const relevant = Array.from({ length: 7 }, (_, index) => ({
      id: `ISSUE-${index + 1}`,
      module: 'IssueUI',
      severity: index === 0 ? 'critical' : 'medium',
      lesson: `issue lesson ${index + 1}`,
    }));
    const irrelevant = Array.from({ length: 3 }, (_, index) => ({
      id: `BILLING-${index + 1}`,
      module: 'Billing',
      severity: 'critical',
      lesson: `billing critical lesson ${index + 1}`,
    }));
    fs.writeFileSync(path.join(projectDir, 'gotchas.yaml'), stringifyYaml({ entries: [...relevant, ...irrelevant] }));

    fs.writeFileSync(path.join(projectRoot, 'src/issues/ui/page.ts'), 'export const issuePage = 2;\n');
    const readiness = run(projectRoot, 'context-readiness.ts', [taskId, '--verify']);
    assert.equal(readiness.status, 0, readiness.stderr || readiness.stdout);
    const scope = run(projectRoot, 'context-scope.ts', [taskId, '--generate']);
    assert.equal(scope.status, 0, scope.stderr || scope.stdout);
    const contextRun = run(projectRoot, 'context-select.ts', [taskId, '--generate']);
    assert.equal(contextRun.status, 0, contextRun.stderr || contextRun.stdout);

    const context = JSON.parse(fs.readFileSync(path.join(taskDir, 'context.json'), 'utf8')) as {
      retrieval: { max_items_per_source: number; scoring: Record<string, number> };
      selected: Record<string, { items?: Array<{ score: number; reasons: string[]; entry: { id?: string } }>; total_matches?: number }>;
    };
    assert.equal(context.retrieval.max_items_per_source, 5);
    assert.equal(context.retrieval.scoring.minimum_scope_matches, 1);
    const gotchas = context.selected.gotchas;
    assert.equal(gotchas?.total_matches, 7, 'unrelated Billing critical entries must not count as matches');
    assert.equal(gotchas?.items?.length, 5, 'selection must stay bounded by Top-K');
    assert.equal(gotchas?.items?.some(item => String(item.entry.id).startsWith('BILLING-')), false);
    assert.equal(gotchas?.items?.[0]?.entry.id, 'ISSUE-1', 'severity may boost rank only after Scope relevance admits the entry');
    assert.deepEqual(gotchas?.items?.[0]?.reasons, ['module', 'severity']);
    assert.equal(gotchas?.items?.every(item => item.reasons.includes('module')), true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
