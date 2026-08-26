import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  GATES,
  evidenceExclusions,
  repositorySnapshot,
  type EvidenceFile,
  type GateName,
} from '../.harness/scripts/lib/evidence-runtime.ts';

function run(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', env: env ?? process.env });
}
function taskDir(taskId: string) { return path.join('docs/wip', taskId); }
function cleanup(taskId: string) { fs.rmSync(taskDir(taskId), { recursive: true, force: true }); }
function writePlanning(taskId: string) {
  const dir = taskDir(taskId);
  fs.writeFileSync(path.join(dir, 'spec.md'), [
    '# Specification', '',
    '## Problem', 'The delivery fixture must exercise deterministic lifecycle governance.', '',
    '## User Scenarios', 'A task can reach Delivery only after required artifacts and checks pass.', '',
    '## Functional Requirements', '- Delivery validates the configured lifecycle contracts.', '',
    '## Acceptance Criteria', '- [x] The expected gate outcome is machine verified.', '',
    '## Edge Cases', '- Missing or stale artifacts stop at their exact boundary.', '',
    '## Out of Scope', '- Product behavior outside this isolated lifecycle fixture.', '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'plan.md'), [
    '# Plan', '',
    '## Technical Context', 'The fixture invokes Engine scripts against a task-local repository state.', '',
    '## Architecture', 'Task artifacts feed Context, Evidence, and Delivery validators.', '',
    '## Data Model and Contracts', 'The task uses repository-owned YAML, Markdown, and JSON records.', '',
    '## Implementation Strategy', 'Prepare only the artifacts required for each focused assertion.', '',
    '## Verification Strategy', 'Assert the exact first failing or successful lifecycle boundary.', '',
    '## Risks and Mitigations', 'Fresh snapshots prevent fixtures from reusing stale verification.', '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'tasks.md'), [
    '# Tasks', '',
    '## Implementation Tasks', '- [x] Prepare the focused delivery fixture artifacts.', '',
    '## Dependencies', 'Planning precedes Context, Evidence, and Delivery.', '',
    '## Verification Tasks', '- [x] Assert the intended delivery boundary.', '',
    '## Acceptance Mapping', 'Each test maps to one delivery contract assertion.', '',
  ].join('\n'));
}
function init(taskId: string) {
  cleanup(taskId);
  const result = run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  writePlanning(taskId);
  const planPath = path.join(taskDir(taskId), 'test-plan.md');
  const plan = fs.readFileSync(planPath, 'utf8')
    .replaceAll('- [ ] DOC_STRUCTURE:', '- [x] DOC_STRUCTURE:')
    .replaceAll('- [ ] LINK_OR_EXAMPLE_CHECK:', '- [x] LINK_OR_EXAMPLE_CHECK:');
  fs.writeFileSync(planPath, plan);
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
function writePlan(taskId: string, selected: string[], env?: NodeJS.ProcessEnv) {
  fs.writeFileSync(path.join(taskDir(taskId), 'skill-plan.yaml'), stringifyYaml({
    version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected,
  }));
  const result = run(['.harness/scripts/skill-plan.ts', taskId, '--resolve'], env);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
function rootCauseContent(rootCause = 'Refresh coordination is missing.') {
  return `# Root Cause Analysis\n\n## Observed Symptom\nDuplicate refresh requests occur.\n\n## Reproduction\nConcurrent requests reproduce the defect.\n\n## Root Cause\n${rootCause}\n\n## Affected Scope\nAuthentication request flow.\n\n## Evidence\nRegression evidence may be added by a verification Skill.\n`;
}
function createProjectFixture(taskId: string) {
  const fixture = path.join(taskDir(taskId), 'fixture-project');
  fs.mkdirSync(fixture, { recursive: true });
  fs.writeFileSync(path.join(fixture, 'profile.yaml'), 'name: fixture\n');
  fs.writeFileSync(path.join(fixture, 'architecture.yaml'), stringifyYaml({ modules: [] }));
  fs.writeFileSync(path.join(fixture, 'bug-ledger.yaml'), stringifyYaml({ entries: [] }));
  fs.writeFileSync(path.join(fixture, 'gotchas.yaml'), stringifyYaml({ entries: [] }));
  fs.writeFileSync(path.join(fixture, 'decisions.yaml'), stringifyYaml({ entries: [] }));
  return fixture;
}
function writeFreshEvidence(taskId: string, gates: GateName[]) {
  const root = process.cwd();
  const dir = path.resolve(taskDir(taskId));
  const snapshot = repositorySnapshot(root, evidenceExclusions(root, dir));
  const now = new Date().toISOString();
  const evidence: EvidenceFile = { version: '1.1', task_id: taskId, updated_at: now, gates: {} };
  for (const gate of gates) {
    evidence.gates[gate] = {
      gate, command: GATES[gate], started_at: now, finished_at: now,
      exit_code: 0, result: 'PASS', repository: snapshot, repository_unchanged: true,
    };
  }
  fs.writeFileSync(path.join(dir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}
function prepareP3L0(taskId: string, withOutput = true) {
  init(taskId);
  writeClassification(taskId);
  const fixture = createProjectFixture(taskId);
  const env = { ...process.env, ACLH_PROJECT_DIR: fixture };
  writePlan(taskId, ['root-cause-analysis'], env);
  if (withOutput) fs.writeFileSync(path.join(taskDir(taskId), 'root-cause-analysis.md'), rootCauseContent());
  const context = run(['.harness/scripts/context-select.ts', taskId, '--generate'], env);
  assert.equal(context.status, 0, context.stderr || context.stdout);
  return env;
}

test('P3 delivery requires Classification before any Skill lifecycle can pass', () => {
  const taskId = `TEST-P3-DELIVERY-CLASS-${process.pid}`;
  init(taskId);
  try {
    fs.writeFileSync(path.join(taskDir(taskId), 'skill-plan.yaml'), stringifyYaml({
      version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected: ['root-cause-analysis'], resolved: ['root-cause-analysis'],
    }));
    const result = run(['.harness/scripts/delivery-gate.ts', taskId]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /classification\.yaml missing/);
  } finally { cleanup(taskId); }
});

test('P3 delivery requires structurally complete Skill outputs before Evidence', () => {
  const taskId = `TEST-P3-DELIVERY-OUTPUT-${process.pid}`;
  const env = prepareP3L0(taskId, false);
  try {
    writeFreshEvidence(taskId, ['check']);
    const result = run(['.harness/scripts/delivery-gate.ts', taskId], env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required Skill output missing: root-cause-analysis\.md/);
  } finally { cleanup(taskId); }
});

test('P3 L0 delivery verifies Skill-aware Context even though legacy L0 Context is optional', () => {
  const taskId = `TEST-P3-DELIVERY-CONTEXT-${process.pid}`;
  const env = prepareP3L0(taskId);
  try {
    fs.rmSync(path.join(taskDir(taskId), 'context.json'));
    writeFreshEvidence(taskId, ['check']);
    const result = run(['.harness/scripts/delivery-gate.ts', taskId], env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /context\.json missing/);
  } finally { cleanup(taskId); }
});

test('P3 L0 understanding-only task passes the full delivery chain with fresh check Evidence', () => {
  const taskId = `TEST-P3-DELIVERY-PASS-${process.pid}`;
  const env = prepareP3L0(taskId);
  try {
    writeFreshEvidence(taskId, ['check']);
    const result = run(['.harness/scripts/delivery-gate.ts', taskId], env);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /PASS for risk L0 \/ P3 Skill Plan/);
  } finally { cleanup(taskId); }
});

test('P3 delivery rejects stale risk Evidence after task content changes even when Context is regenerated', () => {
  const taskId = `TEST-P3-DELIVERY-STALE-${process.pid}`;
  const env = prepareP3L0(taskId);
  try {
    writeFreshEvidence(taskId, ['check']);
    fs.writeFileSync(path.join(taskDir(taskId), 'root-cause-analysis.md'), rootCauseContent('A missing single-flight guard causes duplicate refreshes.'));
    const regenerate = run(['.harness/scripts/context-select.ts', taskId, '--generate'], env);
    assert.equal(regenerate.status, 0, regenerate.stderr || regenerate.stdout);
    const result = run(['.harness/scripts/delivery-gate.ts', taskId], env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /check: stale evidence/);
  } finally { cleanup(taskId); }
});

test('legacy P2 L0 delivery keeps Context optional when no Skill Plan exists', () => {
  const taskId = `TEST-P3-DELIVERY-P2-${process.pid}`;
  init(taskId);
  try {
    assert.equal(fs.existsSync(path.join(taskDir(taskId), 'skill-plan.yaml')), false);
    assert.equal(fs.existsSync(path.join(taskDir(taskId), 'context.json')), false);
    writeFreshEvidence(taskId, ['check']);
    const result = run(['.harness/scripts/delivery-gate.ts', taskId]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /fresh task context not required by risk L0/);
    assert.match(result.stdout, /P2 compatibility workflow/);
  } finally { cleanup(taskId); }
});
