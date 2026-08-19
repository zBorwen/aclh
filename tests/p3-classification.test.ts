import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { stringify as stringifyYaml } from 'yaml';

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
function writeClassification(taskId: string, overrides: Record<string, unknown> = {}) {
  const base = {
    version: '1.0',
    task_id: taskId,
    classification: {
      primary: 'bug',
      traits: ['behavior-change'],
      confidence: 'high',
      rationale: ['existing behavior is incorrect'],
      ambiguities: [],
      source: 'codex',
    },
  };
  const document = { ...base, ...overrides };
  fs.writeFileSync(path.join(taskDir(taskId), 'classification.yaml'), stringifyYaml(document));
}

test('classification contract accepts a valid v1 artifact', () => {
  const taskId = `TEST-P3-CLASS-VALID-${process.pid}`;
  init(taskId);
  try {
    writeClassification(taskId);
    const result = run(['.harness/scripts/classification.ts', taskId, '--verify']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Classification PASS/);
  } finally { cleanup(taskId); }
});

test('classification contract rejects invalid primary, trait, confidence and source values', () => {
  const cases = [
    ['primary', { primary: 'performance' }, /primary must be one of/],
    ['trait', { traits: ['magic-trait'] }, /unknown trait/],
    ['confidence', { confidence: '0.91' }, /confidence must be one of/],
    ['source', { source: 'model' }, /source must be one of/],
  ] as const;

  for (const [name, classificationPatch, expected] of cases) {
    const taskId = `TEST-P3-CLASS-${name}-${process.pid}`;
    init(taskId);
    try {
      writeClassification(taskId, {
        classification: {
          primary: 'bug', traits: ['behavior-change'], confidence: 'high',
          rationale: ['existing behavior is incorrect'], ambiguities: [], source: 'codex',
          ...classificationPatch,
        },
      });
      const result = run(['.harness/scripts/classification.ts', taskId, '--verify']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
    } finally { cleanup(taskId); }
  }
});

test('classification contract rejects missing rationale, task mismatch and unknown fields', () => {
  const cases = [
    ['rationale', {
      classification: { primary: 'bug', traits: [], confidence: 'high', rationale: [], ambiguities: [], source: 'human' },
    }, /rationale must not be empty/],
    ['task', { task_id: 'OTHER-TASK' }, /task_id must match/],
    ['unknown', { unexpected: true }, /root contains unknown field/],
  ] as const;

  for (const [name, patch, expected] of cases) {
    const taskId = `TEST-P3-CLASS-BAD-${name}-${process.pid}`;
    init(taskId);
    try {
      writeClassification(taskId, patch as Record<string, unknown>);
      const result = run(['.harness/scripts/classification.ts', taskId, '--verify']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
    } finally { cleanup(taskId); }
  }
});

test('classification contract rejects malformed yaml and duplicate traits', () => {
  const malformedTask = `TEST-P3-CLASS-YAML-${process.pid}`;
  init(malformedTask);
  try {
    fs.writeFileSync(path.join(taskDir(malformedTask), 'classification.yaml'), 'version: [broken');
    const malformed = run(['.harness/scripts/classification.ts', malformedTask, '--verify']);
    assert.notEqual(malformed.status, 0);
    assert.match(malformed.stderr, /invalid YAML/);
  } finally { cleanup(malformedTask); }

  const duplicateTask = `TEST-P3-CLASS-DUP-${process.pid}`;
  init(duplicateTask);
  try {
    writeClassification(duplicateTask, {
      classification: {
        primary: 'feature', traits: ['cross-module', 'cross-module'], confidence: 'medium',
        rationale: ['new behavior spans multiple modules'], ambiguities: [], source: 'human',
      },
    });
    const duplicate = run(['.harness/scripts/classification.ts', duplicateTask, '--verify']);
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /traits must be unique/);
  } finally { cleanup(duplicateTask); }
});
