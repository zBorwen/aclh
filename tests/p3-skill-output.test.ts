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
function taskDir(taskId: string) { return path.join('docs/wip',taskId); }
function cleanup(taskId: string) { fs.rmSync(taskDir(taskId),{recursive:true,force:true}); }
function init(taskId: string) {
  cleanup(taskId);
  const result=run(['.harness/scripts/init-task.ts',taskId,'--risk','L0','--strategy','docs']);
  assert.equal(result.status,0,result.stderr||result.stdout);
  fs.writeFileSync(path.join(taskDir(taskId),'classification.yaml'),stringifyYaml({
    version:'1.0',task_id:taskId,classification:{
      primary:'bug',traits:['behavior-change'],confidence:'high',
      rationale:['existing behavior is incorrect'],ambiguities:[],source:'codex',
    },
  }));
}
function plan(taskId: string, selected: string[]) {
  fs.writeFileSync(path.join(taskDir(taskId),'skill-plan.yaml'),stringifyYaml({
    version:'1.0',task_id:taskId,classification:{ref:'classification.yaml'},selected,
  }));
  const result=run(['.harness/scripts/skill-plan.ts',taskId,'--resolve']);
  assert.equal(result.status,0,result.stderr||result.stdout);
}
function rootCauseContent() {
  return `# Root Cause Analysis\n\n## Observed Symptom\nDuplicate refresh requests occur.\n\n## Reproduction\nConcurrent requests reproduce the defect.\n\n## Root Cause\nRefresh coordination is missing.\n\n## Affected Scope\nAuthentication request flow.\n\n## Evidence\nRegression verification is required.\n`;
}
function regressionContent() {
  return `# Regression Verification\n\n## Regression Scenarios\nConcurrent 401 requests are covered.\n\n## Observable Behavior\nOnly one refresh operation is allowed.\n\n## Test Coverage\nAutomated regression test covers the scenario.\n\n## Evidence\nMachine test evidence will be required.\n`;
}
function compatibilityContent() {
  return `# Compatibility Verification\n\n## Compatibility Boundaries\nExisting authentication callers remain supported.\n\n## Preserved Behavior\nSuccessful sessions continue without API changes.\n\n## Risks\nRefresh timing is compatibility-sensitive.\n\n## Evidence\nMachine evidence is required.\n`;
}

test('Skill output registry fully covers the repository Skill catalog',()=>{
  const result=run(['.harness/scripts/skill-output.ts','--check-catalog']);
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.match(result.stdout,/5 artifact contract\(s\) cover 5 skill\(s\)/);
});

test('Skill output verifier requires artifacts for the current resolved Skill Plan',()=>{
  const taskId=`TEST-P3-OUTPUT-MISSING-${process.pid}`;
  init(taskId);
  try {
    plan(taskId,['root-cause-analysis']);
    const result=run(['.harness/scripts/skill-output.ts',taskId,'--verify']);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/required Skill output missing: root-cause-analysis\.md/);
  } finally { cleanup(taskId); }
});

test('Skill output verifier rejects missing or placeholder required sections',()=>{
  const taskId=`TEST-P3-OUTPUT-SECTION-${process.pid}`;
  init(taskId);
  try {
    plan(taskId,['root-cause-analysis']);
    fs.writeFileSync(path.join(taskDir(taskId),'root-cause-analysis.md'),`# Root Cause Analysis\n\n## Observed Symptom\nTODO\n`);
    const result=run(['.harness/scripts/skill-output.ts',taskId,'--verify']);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/(required section has no completed content: Observed Symptom|missing required section: Reproduction)/);
  } finally { cleanup(taskId); }
});

test('Skill output verifier accepts structurally complete outputs for multiple resolved skills',()=>{
  const taskId=`TEST-P3-OUTPUT-PASS-${process.pid}`;
  init(taskId);
  try {
    plan(taskId,['regression-verification','root-cause-analysis']);
    fs.writeFileSync(path.join(taskDir(taskId),'root-cause-analysis.md'),rootCauseContent());
    fs.writeFileSync(path.join(taskDir(taskId),'regression-verification.md'),regressionContent());
    const result=run(['.harness/scripts/skill-output.ts',taskId,'--verify']);
    assert.equal(result.status,0,result.stderr||result.stdout);
  } finally { cleanup(taskId); }
});

test('changing the Skill Plan changes the required output set',()=>{
  const taskId=`TEST-P3-OUTPUT-PLAN-${process.pid}`;
  init(taskId);
  try {
    plan(taskId,['root-cause-analysis']);
    fs.writeFileSync(path.join(taskDir(taskId),'root-cause-analysis.md'),rootCauseContent());
    assert.equal(run(['.harness/scripts/skill-output.ts',taskId,'--verify']).status,0);

    fs.writeFileSync(path.join(taskDir(taskId),'skill-plan.yaml'),stringifyYaml({
      version:'1.0',task_id:taskId,classification:{ref:'classification.yaml'},selected:['compatibility-verification'],
    }));
    assert.equal(run(['.harness/scripts/skill-plan.ts',taskId,'--resolve']).status,0);
    const missing=run(['.harness/scripts/skill-output.ts',taskId,'--verify']);
    assert.notEqual(missing.status,0);
    assert.match(missing.stderr,/compatibility-verification\.md/);
    fs.writeFileSync(path.join(taskDir(taskId),'compatibility-verification.md'),compatibilityContent());
    assert.equal(run(['.harness/scripts/skill-output.ts',taskId,'--verify']).status,0);
  } finally { cleanup(taskId); }
});

test('Skill output catalog validation rejects incomplete artifact registries',()=>{
  const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'aclh-p3-output-registry-'));
  try {
    const registry=path.join(tempDir,'outputs.yaml');
    fs.writeFileSync(registry,stringifyYaml({version:'1.0',artifacts:{
      'task-decomposition':{path:'task-decomposition.md',required_sections:['Task Slices']},
    }}));
    const result=run(['.harness/scripts/skill-output.ts','--check-catalog'],{...process.env,ACLH_SKILL_OUTPUTS:registry});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/output artifact has no registry contract/);
  } finally { fs.rmSync(tempDir,{recursive:true,force:true}); }
});
