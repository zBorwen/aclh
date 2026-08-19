#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadClassification } from './lib/classification-runtime.ts';
import { loadSkillPlan } from './lib/skill-plan-runtime.ts';
import {
  loadSkillOutputRegistry,
  validateSkillOutputCoverage,
  verifyResolvedSkillOutputs,
} from './lib/skill-output-runtime.ts';
import {
  loadContextCapabilities,
  loadSkillCatalog,
  resolveSkillIds,
  validateSkillContextCapabilities,
} from './lib/skill-runtime.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SKILLS_DIR = process.env.ACLH_SKILLS_DIR
  ? path.resolve(ROOT, process.env.ACLH_SKILLS_DIR)
  : path.join(ROOT, '.harness/skills');
const CAPABILITY_REGISTRY = process.env.ACLH_CONTEXT_CAPABILITIES
  ? path.resolve(ROOT, process.env.ACLH_CONTEXT_CAPABILITIES)
  : path.join(ROOT, '.harness/context/capabilities.yaml');
const OUTPUT_REGISTRY = process.env.ACLH_SKILL_OUTPUTS
  ? path.resolve(ROOT, process.env.ACLH_SKILL_OUTPUTS)
  : path.join(ROOT, '.harness/artifacts/skill-outputs.yaml');

function fail(message: string): never {
  console.error(`Skill Output FAIL: ${message}`);
  process.exit(1);
}
function sameArray(a: string[] | undefined, b: string[]): boolean {
  return Boolean(a && a.length === b.length && a.every((value,index)=>value===b[index]));
}

const args = process.argv.slice(2);
try {
  const catalog = loadSkillCatalog(SKILLS_DIR);
  const capabilities = loadContextCapabilities(CAPABILITY_REGISTRY);
  validateSkillContextCapabilities(catalog,capabilities);
  const outputRegistry = loadSkillOutputRegistry(OUTPUT_REGISTRY);
  validateSkillOutputCoverage(catalog,outputRegistry);

  if (args.length===1 && args[0]==='--check-catalog') {
    console.log(`Skill Output Contract PASS: ${outputRegistry.size} artifact contract(s) cover ${catalog.size} skill(s)`);
    process.exit(0);
  }

  const taskId = args[0];
  if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || args[1]!=='--verify' || args.length!==2) {
    console.error('Usage: node .harness/scripts/skill-output.ts --check-catalog');
    console.error('   or: node .harness/scripts/skill-output.ts <TASK_ID> --verify');
    process.exit(1);
  }

  const taskDir = path.join(ROOT,'docs/wip',taskId);
  if (!fs.existsSync(taskDir)) fail(`task not found: ${taskId}`);
  loadClassification(path.join(taskDir,'classification.yaml'),taskId);
  const plan = loadSkillPlan(path.join(taskDir,'skill-plan.yaml'),taskId,true);
  const resolved = resolveSkillIds(plan.selected,catalog);
  if (!sameArray(plan.resolved,resolved)) fail(`skill-plan resolved skills are stale; expected: ${resolved.join(' -> ')}`);
  verifyResolvedSkillOutputs(taskDir,resolved,catalog,outputRegistry);
  console.log(`Skill Output PASS for ${taskId}: outputs complete for ${resolved.length} resolved skill(s)`);
} catch (error) {
  fail((error as Error).message);
}
