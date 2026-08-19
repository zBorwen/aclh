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
function tempSkillsDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-p3-skills-')); }
function tempFile(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return { dir, file: path.join(dir, 'capabilities.yaml') };
}
function cleanup(dir: string) { fs.rmSync(dir, { recursive: true, force: true }); }
function skillDocument(id: string, patch: Record<string, unknown> = {}) {
  const base = {
    skill: { id, version: '1.0', kind: 'understanding' },
    description: `Test capability ${id}`,
    requires: { context: { required: ['changed-files'], optional: [] }, skills: [] },
    produces: { artifacts: [`${id}-artifact`], facts: [] },
    completion: { invariants: ['test invariant'] },
  };
  return { ...base, ...patch };
}
function writeSkill(dir: string, filename: string, document: unknown) {
  fs.writeFileSync(path.join(dir, filename), stringifyYaml(document));
}

test('repository skill catalog satisfies Skill Contract v1', () => {
  const result = run(['.harness/scripts/skill-check.ts', '--all']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /5 skill\(s\) validated/);
});

test('skill contract rejects invalid kind, context overlap and empty invariants', () => {
  const cases: Array<[string, unknown, RegExp]> = [
    ['bad-kind.yaml', skillDocument('bad-kind', { skill: { id: 'bad-kind', version: '1.0', kind: 'execution' } }), /skill.kind must be understanding or verification/],
    ['overlap.yaml', skillDocument('overlap', { requires: { context: { required: ['changed-files'], optional: ['changed-files'] }, skills: [] } }), /context cannot be both required and optional/],
    ['empty-invariants.yaml', skillDocument('empty-invariants', { completion: { invariants: [] } }), /completion.invariants must not be empty/],
  ];

  for (const [filename, document, expected] of cases) {
    const dir = tempSkillsDir();
    try {
      writeSkill(dir, filename, document);
      const result = run(['.harness/scripts/skill-check.ts', '--all'], { ...process.env, ACLH_SKILLS_DIR: dir });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
    } finally { cleanup(dir); }
  }
});

test('skill contract rejects unknown and self dependencies', () => {
  const unknownDir = tempSkillsDir();
  try {
    writeSkill(unknownDir, 'alpha.yaml', skillDocument('alpha', { requires: { context: { required: [], optional: [] }, skills: ['missing'] } }));
    const result = run(['.harness/scripts/skill-check.ts', '--all'], { ...process.env, ACLH_SKILLS_DIR: unknownDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown skill dependency: missing/);
  } finally { cleanup(unknownDir); }

  const selfDir = tempSkillsDir();
  try {
    writeSkill(selfDir, 'alpha.yaml', skillDocument('alpha', { requires: { context: { required: [], optional: [] }, skills: ['alpha'] } }));
    const result = run(['.harness/scripts/skill-check.ts', '--all'], { ...process.env, ACLH_SKILLS_DIR: selfDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /skill cannot depend on itself/);
  } finally { cleanup(selfDir); }
});

test('skill contract rejects filename/id mismatch and unknown fields', () => {
  const mismatchDir = tempSkillsDir();
  try {
    writeSkill(mismatchDir, 'wrong-name.yaml', skillDocument('actual-name'));
    const result = run(['.harness/scripts/skill-check.ts', '--all'], { ...process.env, ACLH_SKILLS_DIR: mismatchDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /filename must match skill.id/);
  } finally { cleanup(mismatchDir); }

  const unknownDir = tempSkillsDir();
  try {
    writeSkill(unknownDir, 'alpha.yaml', { ...skillDocument('alpha'), prompt: 'do something' });
    const result = run(['.harness/scripts/skill-check.ts', '--all'], { ...process.env, ACLH_SKILLS_DIR: unknownDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /root contains unknown field\(s\): prompt/);
  } finally { cleanup(unknownDir); }
});

test('skill contract rejects Context capabilities that Runtime does not support', () => {
  const dir = tempSkillsDir();
  try {
    writeSkill(dir, 'alpha.yaml', skillDocument('alpha', {
      requires: { context: { required: ['dependency-graph'], optional: [] }, skills: [] },
    }));
    const result = run(['.harness/scripts/skill-check.ts', '--all'], { ...process.env, ACLH_SKILLS_DIR: dir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown context capability: dependency-graph/);
  } finally { cleanup(dir); }
});

test('Context capability registry rejects invalid resolver/source contracts', () => {
  const skillsDir = tempSkillsDir();
  writeSkill(skillsDir, 'alpha.yaml', skillDocument('alpha'));

  const invalidResolver = tempFile('aclh-p3-context-');
  try {
    fs.writeFileSync(invalidResolver.file, stringifyYaml({
      version: '1.0', capabilities: { 'changed-files': { resolver: 'magic' } },
    }));
    const result = run(['.harness/scripts/skill-check.ts', '--all'], {
      ...process.env,
      ACLH_SKILLS_DIR: skillsDir,
      ACLH_CONTEXT_CAPABILITIES: invalidResolver.file,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid resolver/);
  } finally { cleanup(invalidResolver.dir); }

  const missingSource = tempFile('aclh-p3-context-');
  try {
    fs.writeFileSync(missingSource.file, stringifyYaml({
      version: '1.0', capabilities: { 'changed-files': { resolver: 'changed-files' }, architecture: { resolver: 'project-file' } },
    }));
    const result = run(['.harness/scripts/skill-check.ts', '--all'], {
      ...process.env,
      ACLH_SKILLS_DIR: skillsDir,
      ACLH_CONTEXT_CAPABILITIES: missingSource.file,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /project-file resolver requires source/);
  } finally {
    cleanup(missingSource.dir);
    cleanup(skillsDir);
  }
});
