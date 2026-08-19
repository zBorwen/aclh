import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { stringify as stringifyYaml } from 'yaml';

function run(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', env: env ?? process.env });
}
function taskDir(taskId: string) { return path.join('docs/wip', taskId); }
function cleanup(taskId: string) { fs.rmSync(taskDir(taskId), { recursive: true, force: true }); }
function init(taskId: string) {
  cleanup(taskId);
  const result = run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L1', '--strategy', 'tdd']);
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
function writePlan(taskId: string, selected: string[]) {
  fs.writeFileSync(path.join(taskDir(taskId), 'skill-plan.yaml'), stringifyYaml({
    version: '1.0', task_id: taskId, classification: { ref: 'classification.yaml' }, selected,
  }));
}
function createProjectFixture(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.yaml'), 'name: fixture\n');
  fs.writeFileSync(path.join(dir, 'architecture.yaml'), stringifyYaml({
    modules: [
      { name: 'Auth', path: 'src/auth', depends_on: ['Core'] },
      { name: 'Core', path: 'src/core', depends_on: [] },
      { name: 'Billing', path: 'src/billing', depends_on: [] },
    ],
  }));
  fs.writeFileSync(path.join(dir, 'bug-ledger.yaml'), stringifyYaml({ entries: [
    { id: 'BUG-AUTH', module: 'Auth', severity: 'high', affected_files: ['src/auth/login.ts'] },
    { id: 'BUG-BILLING', module: 'Billing' },
  ] }));
  fs.writeFileSync(path.join(dir, 'gotchas.yaml'), stringifyYaml({ entries: [
    { id: 'GOTCHA-AUTH', modules: ['Auth'], tags: ['react'] },
  ] }));
  fs.writeFileSync(path.join(dir, 'decisions.yaml'), stringifyYaml({ entries: [
    { id: 'ADR-AUTH', modules: ['Auth'], tags: ['react'] },
  ] }));
}
function fixtureSkill(id: string, required: string[], dependencies: string[] = []) {
  return {
    skill: { id, version: '1.0', kind: 'understanding' }, description: id,
    requires: { context: { required, optional: [] }, skills: dependencies },
    produces: { artifacts: [`${id}-artifact`], facts: [] },
    completion: { invariants: ['complete'] },
  };
}

test('Skill-aware Context differs by Skill Plan and binds repository content plus plan freshness', () => {
  const taskId = `TEST-P3-CONTEXT-SKILLS-${process.pid}`;
  init(taskId);
  try {
    const dir = taskDir(taskId);
    const statePath = path.join(dir, '.state.yaml');
    const state = (await import('yaml')).parse(fs.readFileSync(statePath, 'utf8')) as any;
    state.context_scope = { modules: ['Auth'], tags: ['react'], files: ['src/auth/login.ts'] };
    fs.writeFileSync(statePath, stringifyYaml(state));
    writeClassification(taskId);
    writePlan(taskId, ['root-cause-analysis']);
    const resolveRoot = run(['.harness/scripts/skill-plan.ts', taskId, '--resolve']);
    assert.equal(resolveRoot.status, 0, resolveRoot.stderr || resolveRoot.stdout);

    const fixture = path.join(dir, 'fixture-project');
    createProjectFixture(fixture);
    const sourceInput = path.join(dir, 'source-input.txt');
    fs.writeFileSync(sourceInput, 'v1');
    const env = { ...process.env, ACLH_PROJECT_DIR: fixture };

    const generateRoot = run(['.harness/scripts/context-select.ts', taskId, '--generate'], env);
    assert.equal(generateRoot.status, 0, generateRoot.stderr || generateRoot.stdout);
    let context = JSON.parse(fs.readFileSync(path.join(dir, 'context.json'), 'utf8')) as any;
    assert.equal(context.version, '2.0');
    assert.equal(context.mode, 'skill-aware');
    assert.ok(context.requirements['bug-ledger']);
    assert.ok(context.requirements['changed-files']);
    assert.ok(context.requirements.architecture);
    assert.ok(context.requirements.gotchas);
    assert.equal(context.requirements.decisions, undefined);
    assert.equal(context.requirements['project-profile'], undefined);
    assert.equal(context.selected['bug-ledger'].items[0].entry.id, 'BUG-AUTH');
    assert.equal(run(['.harness/scripts/context-select.ts', taskId, '--verify'], env).status, 0);

    fs.writeFileSync(sourceInput, 'v2');
    const contentStale = run(['.harness/scripts/context-select.ts', taskId, '--verify'], env);
    assert.notEqual(contentStale.status, 0);
    assert.match(contentStale.stderr, /repository content/);
    assert.equal(run(['.harness/scripts/context-select.ts', taskId, '--generate'], env).status, 0);

    writePlan(taskId, ['compatibility-verification']);
    const resolveCompatibility = run(['.harness/scripts/skill-plan.ts', taskId, '--resolve']);
    assert.equal(resolveCompatibility.status, 0, resolveCompatibility.stderr || resolveCompatibility.stdout);
    const planStale = run(['.harness/scripts/context-select.ts', taskId, '--verify'], env);
    assert.notEqual(planStale.status, 0);
    assert.match(planStale.stderr, /Skill Plan/);

    assert.equal(run(['.harness/scripts/context-select.ts', taskId, '--generate'], env).status, 0);
    context = JSON.parse(fs.readFileSync(path.join(dir, 'context.json'), 'utf8')) as any;
    assert.ok(context.requirements.architecture);
    assert.ok(context.requirements.decisions);
    assert.ok(context.requirements.gotchas);
    assert.equal(context.requirements['bug-ledger'], undefined);
    assert.equal(context.selected['bug-ledger'], undefined);
  } finally { cleanup(taskId); }
});

test('Skill dependency Context requirements expand automatically, deduplicate, and invalidate on contract change', () => {
  const taskId = `TEST-P3-CONTEXT-DAG-${process.pid}`;
  init(taskId);
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-p3-context-skills-'));
  try {
    const dir = taskDir(taskId);
    writeClassification(taskId);
    fs.writeFileSync(path.join(skillsDir, 'child.yaml'), stringifyYaml(fixtureSkill('child', ['decisions'])));
    fs.writeFileSync(path.join(skillsDir, 'parent.yaml'), stringifyYaml(fixtureSkill('parent', ['architecture'], ['child'])));
    fs.writeFileSync(path.join(skillsDir, 'peer.yaml'), stringifyYaml(fixtureSkill('peer', ['architecture'])));
    writePlan(taskId, ['parent', 'peer']);

    const fixture = path.join(dir, 'fixture-project');
    createProjectFixture(fixture);
    const env = { ...process.env, ACLH_PROJECT_DIR: fixture, ACLH_SKILLS_DIR: skillsDir };
    const resolve = run(['.harness/scripts/skill-plan.ts', taskId, '--resolve'], env);
    assert.equal(resolve.status, 0, resolve.stderr || resolve.stdout);
    const generate = run(['.harness/scripts/context-select.ts', taskId, '--generate'], env);
    assert.equal(generate.status, 0, generate.stderr || generate.stdout);

    const context = JSON.parse(fs.readFileSync(path.join(dir, 'context.json'), 'utf8')) as any;
    assert.deepEqual(context.skills, ['child', 'parent', 'peer']);
    assert.deepEqual(context.requirements.decisions.required_by, ['child']);
    assert.deepEqual(context.requirements.architecture.required_by, ['parent', 'peer']);
    assert.equal(Object.keys(context.selected).filter(key => key === 'architecture').length, 1);
    assert.equal(run(['.harness/scripts/context-select.ts', taskId, '--verify'], env).status, 0);

    fs.writeFileSync(path.join(skillsDir, 'child.yaml'), stringifyYaml(fixtureSkill('child', ['bug-ledger'])));
    const planStillValid = run(['.harness/scripts/skill-plan.ts', taskId, '--verify'], env);
    assert.equal(planStillValid.status, 0, planStillValid.stderr || planStillValid.stdout);
    const contractStale = run(['.harness/scripts/context-select.ts', taskId, '--verify'], env);
    assert.notEqual(contractStale.status, 0);
    assert.match(contractStale.stderr, /Context contract/);
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
    cleanup(taskId);
  }
});
