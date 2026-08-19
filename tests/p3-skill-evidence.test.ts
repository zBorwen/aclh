import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { stringify as stringifyYaml } from 'yaml';
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
function init(taskId: string) {
  cleanup(taskId);
  const result = run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L0', '--strategy', 'docs']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
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
  const result = run(['.harness/scripts/skill-plan.ts', taskId, '--resolve']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
function writeFreshEvidence(taskId: string, gates: GateName[]) {
  const root = process.cwd();
  const dir = path.resolve(taskDir(taskId));
  const snapshot = repositorySnapshot(root, evidenceExclusions(root, dir));
  const now = new Date().toISOString();
  const evidence: EvidenceFile = { version: '1.1', task_id: taskId, updated_at: now, gates: {} };
  for (const gate of gates) {
    evidence.gates[gate] = {
      gate,
      command: GATES[gate],
      started_at: now,
      finished_at: now,
      exit_code: 0,
      result: 'PASS',
      repository: snapshot,
      repository_unchanged: true,
    };
  }
  fs.writeFileSync(path.join(dir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}

test('Skill Evidence policy covers every verification Skill and no understanding Skill', () => {
  const result = run(['.harness/scripts/skill-evidence.ts', '--check-policy']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /2 verification Skill mapping\(s\) cover the catalog/);
});

test('L0 risk evidence can pass check-only while regression-verification still requires test evidence', () => {
  const taskId = `TEST-P3-SKILL-EVIDENCE-L0-${process.pid}`;
  init(taskId);
  try {
    writePlan(taskId, ['regression-verification']);
    writeFreshEvidence(taskId, ['check']);

    const riskEvidence = run(['.harness/scripts/evidence.ts', taskId, '--verify']);
    assert.equal(riskEvidence.status, 0, riskEvidence.stderr || riskEvidence.stdout);
    assert.match(riskEvidence.stdout, /risk L0, required gates = check/);

    const skillEvidence = run(['.harness/scripts/skill-evidence.ts', taskId, '--verify']);
    assert.notEqual(skillEvidence.status, 0);
    assert.match(skillEvidence.stderr, /regression-verification -> test: missing or failing evidence/);
  } finally { cleanup(taskId); }
});

test('verification Skill accepts fresh canonical Evidence and rejects it after repository state changes', () => {
  const taskId = `TEST-P3-SKILL-EVIDENCE-FRESH-${process.pid}`;
  init(taskId);
  try {
    writePlan(taskId, ['regression-verification']);
    writeFreshEvidence(taskId, ['test']);
    const fresh = run(['.harness/scripts/skill-evidence.ts', taskId, '--verify']);
    assert.equal(fresh.status, 0, fresh.stderr || fresh.stdout);
    assert.match(fresh.stdout, /regression-verification -> test: fresh PASS evidence present/);

    const classificationPath = path.join(taskDir(taskId), 'classification.yaml');
    const current = fs.readFileSync(classificationPath, 'utf8');
    fs.writeFileSync(classificationPath, current.replace('existing behavior is incorrect', 'existing behavior is observably incorrect'));
    const stale = run(['.harness/scripts/skill-evidence.ts', taskId, '--verify']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /regression-verification -> test: stale evidence/);
  } finally { cleanup(taskId); }
});

test('understanding-only Skill Plan requires no additional Skill Evidence gates', () => {
  const taskId = `TEST-P3-SKILL-EVIDENCE-UNDERSTANDING-${process.pid}`;
  init(taskId);
  try {
    writePlan(taskId, ['root-cause-analysis']);
    const result = run(['.harness/scripts/skill-evidence.ts', taskId, '--verify']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /no verification Skill requires machine evidence/);
  } finally { cleanup(taskId); }
});

test('Skill Evidence policy rejects missing verification mappings and understanding-skill mappings', () => {
  const missingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-p3-skill-evidence-'));
  try {
    const policyPath = path.join(missingDir, 'policy.yaml');
    fs.writeFileSync(policyPath, stringifyYaml({
      version: '1.0',
      verification_skills: {
        'regression-verification': { required_gates: ['test'] },
      },
    }));
    const missing = run(['.harness/scripts/skill-evidence.ts', '--check-policy'], {
      ...process.env,
      ACLH_SKILL_EVIDENCE_POLICY: policyPath,
    });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /verification Skill has no Evidence policy mapping: compatibility-verification/);

    fs.writeFileSync(policyPath, stringifyYaml({
      version: '1.0',
      verification_skills: {
        'regression-verification': { required_gates: ['test'] },
        'compatibility-verification': { required_gates: ['typecheck', 'test'] },
        'root-cause-analysis': { required_gates: ['test'] },
      },
    }));
    const understanding = run(['.harness/scripts/skill-evidence.ts', '--check-policy'], {
      ...process.env,
      ACLH_SKILL_EVIDENCE_POLICY: policyPath,
    });
    assert.notEqual(understanding.status, 0);
    assert.match(understanding.stderr, /understanding Skill must not have an Evidence policy mapping: root-cause-analysis/);
  } finally { fs.rmSync(missingDir, { recursive: true, force: true }); }
});

test('Skill Evidence policy rejects non-canonical and duplicate gates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-p3-skill-evidence-gates-'));
  try {
    const policyPath = path.join(dir, 'policy.yaml');
    fs.writeFileSync(policyPath, stringifyYaml({
      version: '1.0',
      verification_skills: {
        'regression-verification': { required_gates: ['jest'] },
        'compatibility-verification': { required_gates: ['typecheck', 'test'] },
      },
    }));
    const unknown = run(['.harness/scripts/skill-evidence.ts', '--check-policy'], {
      ...process.env,
      ACLH_SKILL_EVIDENCE_POLICY: policyPath,
    });
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /canonical gates/);

    fs.writeFileSync(policyPath, stringifyYaml({
      version: '1.0',
      verification_skills: {
        'regression-verification': { required_gates: ['test', 'test'] },
        'compatibility-verification': { required_gates: ['typecheck', 'test'] },
      },
    }));
    const duplicate = run(['.harness/scripts/skill-evidence.ts', '--check-policy'], {
      ...process.env,
      ACLH_SKILL_EVIDENCE_POLICY: policyPath,
    });
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /duplicate gate/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
