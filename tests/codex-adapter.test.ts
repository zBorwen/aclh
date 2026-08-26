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
  assert.match(content, /fresh independent reviewer/i);
  assert.match(content, /After Review, report findings and stop/i);
  assert.match(content, /references\/lifecycle\.md/);
  assert.match(content, /task-status\.ts/);
  assert.match(content, /task-contract\.ts/);
  assert.match(content, /do not rediscover them from Runtime[\s\S]*README files/i);
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
    'builder-finalize.ts <TASK_ID> --json',
    'task-planning.ts <TASK_ID> --verify',
    'independent-review.ts <TASK_ID> --prepare',
    'task-status.ts <TASK_ID> --review-ready --json',
    'review-decision.ts <TASK_ID> --accept',
    'review-decision.ts <TASK_ID> --repair',
    'delivery-gate.ts <TASK_ID>',
  ];

  for (const command of requiredCommands) {
    assert.ok(lifecycle.includes(command), `adapter lifecycle must delegate to ${command}`);
  }

  assert.match(lifecycle, /Do not write `resolved` manually/);
  assert.match(lifecycle, /Report the result and stop/i);
  assert.match(lifecycle, /Builder self-review is available but not a default delivery gate/i);
  assert.match(lifecycle, /writes\s+only `independent-review\.json`/i);
  assert.match(lifecycle, /Never infer acceptance or repair scope/i);
  assert.match(lifecycle, /Browser verification is opt-in/i);
  assert.doesNotMatch(lifecycle, /browser-verification\.ts[^\n]*--run/);
});
