import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';

const skillDir = path.join('.agents', 'skills', 'aclh-task');
const skillPath = path.join(skillDir, 'SKILL.md');
const metadataPath = path.join(skillDir, 'agents', 'openai.yaml');
const lifecyclePath = path.join(skillDir, 'references', 'lifecycle.md');

function parseSkillFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, 'SKILL.md must start with YAML frontmatter');
  const parsed = parseYaml(match[1]);
  assert.equal(typeof parsed, 'object');
  assert.ok(parsed !== null && !Array.isArray(parsed));
  return parsed as Record<string, unknown>;
}

test('Codex adapter uses the repository-local aclh-task Skill contract', () => {
  assert.equal(fs.existsSync(skillPath), true, 'missing repository Codex SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  const frontmatter = parseSkillFrontmatter(content);

  assert.equal(frontmatter.name, 'aclh-task');
  assert.equal(typeof frontmatter.description, 'string');
  assert.ok((frontmatter.description as string).includes('ACLH'));
  assert.match(content, /thin Codex adapter/i);
  assert.match(content, /must not mechanically map to a fixed Skill set/i);
  assert.match(content, /Never create a same-session independent PASS/i);
  assert.match(content, /references\/lifecycle\.md/);
});

test('Codex adapter requires explicit invocation', () => {
  assert.equal(fs.existsSync(metadataPath), true, 'missing agents/openai.yaml');
  const metadata = parseYaml(fs.readFileSync(metadataPath, 'utf8')) as {
    interface?: { display_name?: unknown; short_description?: unknown };
    policy?: { allow_implicit_invocation?: unknown };
  };

  assert.equal(metadata.interface?.display_name, 'ACLH Task');
  assert.equal(typeof metadata.interface?.short_description, 'string');
  assert.equal(metadata.policy?.allow_implicit_invocation, false);
});

test('Codex adapter lifecycle delegates every trusted transition to ACLH Runtime', () => {
  assert.equal(fs.existsSync(lifecyclePath), true, 'missing lifecycle reference');
  const lifecycle = fs.readFileSync(lifecyclePath, 'utf8');

  const requiredCommands = [
    'init-task.ts <TASK_ID>',
    'classification.ts <TASK_ID> --verify',
    'skill-plan.ts <TASK_ID> --resolve',
    'skill-plan.ts <TASK_ID> --verify',
    'context-select.ts <TASK_ID> --generate',
    'context-select.ts <TASK_ID> --verify',
    'verification-plan.ts <TASK_ID>',
    'skill-output.ts <TASK_ID> --verify',
    'npm run evidence -- <TASK_ID> --verify',
    'skill-evidence.ts <TASK_ID> --verify',
    'self-review.ts <TASK_ID> --prepare',
    'self-review.ts <TASK_ID> --verify',
    'independent-review.ts <TASK_ID> --prepare',
    'delivery-gate.ts <TASK_ID>',
  ];

  for (const command of requiredCommands) {
    assert.ok(lifecycle.includes(command), `adapter lifecycle must delegate to ${command}`);
  }

  assert.match(lifecycle, /Do not write `resolved` manually/);
  assert.match(lifecycle, /must not create an independent PASS/i);
  assert.match(lifecycle, /regenerate and verify Context/i);
  assert.match(lifecycle, /self-review\.json/);
  assert.match(lifecycle, /post-Evidence repository snapshot/i);
});
