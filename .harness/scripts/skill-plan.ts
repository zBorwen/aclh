#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { loadClassification } from './lib/classification-runtime.ts';
import { loadSkillPlan } from './lib/skill-plan-runtime.ts';
import { resolveRuntimeRoots, resolveRuntimeRelative } from './lib/runtime-roots.ts';
import {
  loadContextCapabilities,
  loadSkillCatalog,
  resolveSkillIds,
  validateSkillContextCapabilities,
} from './lib/skill-runtime.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const taskId = process.argv[2];
const mode = process.argv[3];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || !['--resolve', '--verify'].includes(mode) || process.argv.length !== 4) {
  console.error('Usage: node .harness/scripts/skill-plan.ts <TASK_ID> --resolve|--verify');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const planPath = path.join(taskDir, 'skill-plan.yaml');
const classificationPath = path.join(taskDir, 'classification.yaml');
const skillsDir = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_SKILLS_DIR, '.harness/skills');
const capabilityRegistry = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_CONTEXT_CAPABILITIES, '.harness/context/capabilities.yaml');

function fail(message: string): never {
  console.error(`Skill Plan FAIL: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(taskDir)) fail(`task not found: ${taskId}`);

try {
  loadClassification(classificationPath, taskId);
  const catalog = loadSkillCatalog(skillsDir);
  const capabilities = loadContextCapabilities(capabilityRegistry);
  validateSkillContextCapabilities(catalog, capabilities);

  if (mode === '--resolve') {
    const plan = loadSkillPlan(planPath, taskId, false);
    const resolved = resolveSkillIds(plan.selected, catalog);
    const canonical = {
      version: '1.0',
      task_id: taskId,
      classification: { ref: 'classification.yaml' },
      selected: plan.selected,
      resolved,
    };
    fs.writeFileSync(planPath, stringifyYaml(canonical));
    console.log(`Skill Plan resolved for ${taskId}: ${resolved.join(' -> ')}`);
    process.exit(0);
  }

  const plan = loadSkillPlan(planPath, taskId, true);
  const expected = resolveSkillIds(plan.selected, catalog);
  if (!plan.resolved || plan.resolved.length !== expected.length || plan.resolved.some((id, index) => id !== expected[index])) {
    fail(`resolved skills are stale or incorrect; expected: ${expected.join(' -> ')}`);
  }
  console.log(`Skill Plan PASS for ${taskId}: ${plan.resolved.join(' -> ')}`);
} catch (error) {
  fail((error as Error).message);
}
