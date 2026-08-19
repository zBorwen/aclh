import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

function run(args: string[]) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', env: process.env });
}
function taskDir(taskId: string) { return path.join('docs/wip', taskId); }
function cleanup(taskId: string) { fs.rmSync(taskDir(taskId), { recursive: true, force: true }); }
function init(taskId: string) {
  cleanup(taskId);
  const result = run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
function writeClassification(taskId: string) {
  fs.writeFileSync(path.join(taskDir(taskId), 'classification.yaml'), stringifyYaml({
    version: '1.0', task_id: taskId,
    classification: {
      primary: 'bug', traits: ['behavior-change'], confidence: 'high',
      rationale: ['existing behavior is incorrect'], ambiguities: [], source: 'codex',
    },
  }));
}
function writePlan(taskId: string, selected: string[], resolved?: string[]) {
  fs.writeFileSync(path.join(taskDir(taskId), 'skill-plan.yaml'), stringifyYaml({
    version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' },
    selected, ...(resolved ? { resolved } : {}),
  }));
}

test('Skill Plan remains explicit and is not auto-created from Classification', () => {
  const taskId = `TEST-P3-PLAN-EXPLICIT-${process.pid}`;
  init(taskId);
  try {
    writeClassification(taskId);
    const result = run(['.harness/scripts/skill-plan.ts', taskId, '--resolve']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /skill-plan.yaml missing/);
    assert.equal(fs.existsSync(path.join(taskDir(taskId), 'skill-plan.yaml')), false);
  } finally { cleanup(taskId); }
});

test('Skill Plan resolves explicit selected skills into canonical deterministic output', () => {
  const taskId = `TEST-P3-PLAN-RESOLVE-${process.pid}`;
  init(taskId);
  try {
    writeClassification(taskId);
    writePlan(taskId, ['root-cause-analysis', 'regression-verification']);
    const resolve = run(['.harness/scripts/skill-plan.ts', taskId, '--resolve']);
    assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
    const plan = parseYaml(fs.readFileSync(path.join(taskDir(taskId), 'skill-plan.yaml'), 'utf8')) as { selected: string[]; resolved: string[] };
    assert.deepEqual(plan.selected, ['regression-verification', 'root-cause-analysis']);
    assert.deepEqual(plan.resolved, ['regression-verification', 'root-cause-analysis']);
    const verify = run(['.harness/scripts/skill-plan.ts', taskId, '--verify']);
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
  } finally { cleanup(taskId); }
});

test('Skill Plan verify rejects stale resolved output', () => {
  const taskId = `TEST-P3-PLAN-STALE-${process.pid}`;
  init(taskId);
  try {
    writeClassification(taskId);
    writePlan(taskId, ['root-cause-analysis'], ['task-decomposition']);
    const verify = run(['.harness/scripts/skill-plan.ts', taskId, '--verify']);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /resolved skills are stale or incorrect/);
  } finally { cleanup(taskId); }
});

test('Skill Plan rejects duplicate and unknown selected skills', () => {
  const duplicateTask = `TEST-P3-PLAN-DUP-${process.pid}`;
  init(duplicateTask);
  try {
    writeClassification(duplicateTask);
    writePlan(duplicateTask, ['root-cause-analysis', 'root-cause-analysis']);
    const result = run(['.harness/scripts/skill-plan.ts', duplicateTask, '--resolve']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate skill/);
  } finally { cleanup(duplicateTask); }

  const unknownTask = `TEST-P3-PLAN-UNKNOWN-${process.pid}`;
  init(unknownTask);
  try {
    writeClassification(unknownTask);
    writePlan(unknownTask, ['does-not-exist']);
    const result = run(['.harness/scripts/skill-plan.ts', unknownTask, '--resolve']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown selected skill/);
  } finally { cleanup(unknownTask); }
});

test('Skill Plan cannot resolve against an invalid Classification artifact', () => {
  const taskId = `TEST-P3-PLAN-CLASS-${process.pid}`;
  init(taskId);
  try {
    fs.writeFileSync(path.join(taskDir(taskId), 'classification.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId,
      classification: {
        primary: 'magic', traits: [], confidence: 'high',
        rationale: ['invalid on purpose'], ambiguities: [], source: 'codex',
      },
    }));
    writePlan(taskId, ['task-decomposition']);
    const result = run(['.harness/scripts/skill-plan.ts', taskId, '--resolve']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /primary must be one of/);
  } finally { cleanup(taskId); }
});
