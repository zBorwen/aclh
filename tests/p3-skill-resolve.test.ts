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
function tempSkillsDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-p3-resolve-')); }
function skill(id: string, dependencies: string[] = []) {
  return {
    skill: { id, version: '1.0', kind: 'understanding' },
    description: id,
    requires: { context: { required: ['changed-files'], optional: [] }, skills: dependencies },
    produces: { artifacts: [`${id}-artifact`], facts: [] },
    completion: { invariants: ['complete'] },
  };
}
function write(dir: string, id: string, dependencies: string[] = []) {
  fs.writeFileSync(path.join(dir, `${id}.yaml`), stringifyYaml(skill(id, dependencies)));
}
function envFor(dir: string) { return { ...process.env, ACLH_SKILLS_DIR: dir }; }

test('skill resolver expands transitive dependencies dependency-first', () => {
  const dir = tempSkillsDir();
  try {
    write(dir, 'charlie');
    write(dir, 'bravo', ['charlie']);
    write(dir, 'alpha', ['bravo']);
    const result = run(['.harness/scripts/skill-resolve.ts', 'alpha'], envFor(dir));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout) as { selected: string[]; resolved: string[] };
    assert.deepEqual(output.selected, ['alpha']);
    assert.deepEqual(output.resolved, ['charlie', 'bravo', 'alpha']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('skill resolver deduplicates shared dependencies and is deterministic', () => {
  const dir = tempSkillsDir();
  try {
    write(dir, 'core');
    write(dir, 'alpha', ['core']);
    write(dir, 'bravo', ['core']);
    const first = run(['.harness/scripts/skill-resolve.ts', 'bravo', 'alpha', 'alpha'], envFor(dir));
    const second = run(['.harness/scripts/skill-resolve.ts', 'alpha', 'bravo'], envFor(dir));
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(first.stdout, second.stdout);
    const output = JSON.parse(first.stdout) as { resolved: string[] };
    assert.deepEqual(output.resolved, ['core', 'alpha', 'bravo']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('skill resolver rejects dependency cycles', () => {
  const dir = tempSkillsDir();
  try {
    write(dir, 'alpha', ['bravo']);
    write(dir, 'bravo', ['alpha']);
    const result = run(['.harness/scripts/skill-resolve.ts', 'alpha'], envFor(dir));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /skill dependency cycle: alpha -> bravo -> alpha/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('skill resolver rejects unknown selected skills', () => {
  const dir = tempSkillsDir();
  try {
    write(dir, 'alpha');
    const result = run(['.harness/scripts/skill-resolve.ts', 'missing'], envFor(dir));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown selected skill: missing/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
