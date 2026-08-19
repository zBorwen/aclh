#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadContextCapabilities,
  loadSkillCatalog,
  validateSkillContextCapabilities,
} from './lib/skill-runtime.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const skillsDir = process.env.ACLH_SKILLS_DIR
  ? path.resolve(ROOT, process.env.ACLH_SKILLS_DIR)
  : path.join(ROOT, '.harness/skills');
const capabilityRegistry = process.env.ACLH_CONTEXT_CAPABILITIES
  ? path.resolve(ROOT, process.env.ACLH_CONTEXT_CAPABILITIES)
  : path.join(ROOT, '.harness/context/capabilities.yaml');

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node .harness/scripts/skill-check.ts --all | <SKILL_ID>');
  process.exit(1);
}

let catalog;
try {
  catalog = loadSkillCatalog(skillsDir);
  const capabilities = loadContextCapabilities(capabilityRegistry);
  validateSkillContextCapabilities(catalog, capabilities);
} catch (error) {
  console.error(`Skill Contract FAIL: ${(error as Error).message}`);
  process.exit(1);
}

const target = args[0];
if (target === '--all') {
  console.log(`Skill Contract PASS: ${catalog.size} skill(s) validated against Context capability registry`);
  process.exit(0);
}
if (!/^[a-z][a-z0-9-]*$/.test(target)) {
  console.error(`Skill Contract FAIL: invalid skill id: ${target}`);
  process.exit(1);
}
const skill = catalog.get(target);
if (!skill) {
  console.error(`Skill Contract FAIL: unknown skill: ${target}`);
  process.exit(1);
}
console.log(`Skill Contract PASS: ${skill.skill.id}@${skill.skill.version} (${skill.skill.kind})`);
