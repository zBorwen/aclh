#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadContextCapabilities,
  loadSkillCatalog,
  resolveSkillIds,
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

const selected = process.argv.slice(2);
if (selected.length === 0 || selected.some(id => !/^[a-z][a-z0-9-]*$/.test(id))) {
  console.error('Usage: node .harness/scripts/skill-resolve.ts <SKILL_ID> [SKILL_ID...]');
  process.exit(1);
}

try {
  const catalog = loadSkillCatalog(skillsDir);
  const capabilities = loadContextCapabilities(capabilityRegistry);
  validateSkillContextCapabilities(catalog, capabilities);
  const resolved = resolveSkillIds(selected, catalog);
  console.log(JSON.stringify({ version: '1.0', selected: [...new Set(selected)].sort(), resolved }, null, 2));
} catch (error) {
  console.error(`Skill Resolve FAIL: ${(error as Error).message}`);
  process.exit(1);
}
