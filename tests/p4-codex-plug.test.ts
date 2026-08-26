import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';

const ENGINE_ROOT = process.cwd();
const integrationScript = path.join(ENGINE_ROOT, '.harness/scripts/codex-integration.ts');

function createConsumer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-plug-'));
  fs.writeFileSync(path.join(root, 'README.md'), '# consumer\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"consumer","private":true}\n');
  return root;
}

function run(action: 'attach' | 'detach' | 'status', projectRoot: string) {
  return spawnSync(process.execPath, [integrationScript, action, '--project', projectRoot], {
    cwd: ENGINE_ROOT,
    encoding: 'utf8',
    env: process.env,
  });
}

test('external capability manifest keeps every published command supported across rollout stages', () => {
  const manifest = parseYaml(fs.readFileSync(path.join(ENGINE_ROOT, '.harness/external-capabilities.yaml'), 'utf8')) as {
    version: string;
    external_mode: { status: string; commands: Record<string, string> };
  };
  assert.equal(manifest.version, '1.0');
  assert.equal(typeof manifest.external_mode.status, 'string');
  assert.ok(manifest.external_mode.status.length > 0);
  for (const [command, state] of Object.entries(manifest.external_mode.commands)) {
    assert.equal(state, 'supported', `${command} must remain supported once published`);
  }
  for (const command of ['init-task', 'classification', 'skill-plan', 'context-select', 'task-identity', 'task-planning', 'verification-plan', 'skill-output', 'evidence', 'skill-evidence', 'self-review', 'independent-review', 'review-decision', 'task-contract', 'task-status', 'builder-finalize', 'delivery-gate']) {
    assert.equal(manifest.external_mode.commands[command], 'supported');
  }
});

test('Codex integration attaches as a thin full-lifecycle Skill and detaches without touching consumer files', () => {
  const projectRoot = createConsumer();
  try {
    const readmeBefore = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
    const packageBefore = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');

    const attach = run('attach', projectRoot);
    assert.equal(attach.status, 0, attach.stderr || attach.stdout);
    const skillPath = path.join(projectRoot, '.agents/skills/aclh-task/SKILL.md');
    const lifecyclePath = path.join(projectRoot, '.agents/skills/aclh-task/references/lifecycle.md');
    assert.equal(fs.existsSync(skillPath), true);
    assert.equal(fs.existsSync(lifecyclePath), true);
    const skill = fs.readFileSync(skillPath, 'utf8');
    const lifecycle = fs.readFileSync(lifecyclePath, 'utf8');
    assert.match(skill, /thin consumer integration/);
    assert.match(skill, /task-contract\.ts/);
    assert.match(skill, /task-status\.ts/);
    assert.match(skill, /spec\.md -> plan\.md -> tasks\.md/);
    assert.match(lifecycle, /delivery-gate\.ts/);
    assert.match(lifecycle, /task-status\.ts.*--review-ready.*--json/s);
    assert.match(lifecycle, /report implementation, tests, verdict, and findings.*Stop/s);
    assert.match(lifecycle, /review-decision\.ts.*--repair/s);
    assert.ok(skill.length + lifecycle.length < 11_000, 'external Adapter contract must remain bounded');
    assert.equal(fs.existsSync(path.join(projectRoot, '.harness')), false, 'Runtime implementation must stay outside the consumer repo');

    const status = run('status', projectRoot);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    const parsed = JSON.parse(status.stdout) as { mode: string; attached: boolean };
    assert.equal(parsed.mode, 'external');
    assert.equal(parsed.attached, true);

    const detach = run('detach', projectRoot);
    assert.equal(detach.status, 0, detach.stderr || detach.stdout);
    assert.equal(fs.existsSync(path.join(projectRoot, '.agents/skills/aclh-task')), false);
    assert.equal(fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8'), readmeBefore);
    assert.equal(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'), packageBefore);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('detach refuses to remove a non-ACLH Codex Skill', () => {
  const projectRoot = createConsumer();
  try {
    const customSkill = path.join(projectRoot, '.agents/skills/aclh-task');
    fs.mkdirSync(customSkill, { recursive: true });
    fs.writeFileSync(path.join(customSkill, 'SKILL.md'), '# custom\n');
    const detach = run('detach', projectRoot);
    assert.notEqual(detach.status, 0);
    assert.equal(fs.existsSync(path.join(customSkill, 'SKILL.md')), true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
