#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadClassification } from './lib/classification-runtime.ts';
import {
  ALL_GATES,
  evidenceExclusions,
  loadEvidenceFile,
  repositorySnapshot,
  resolveGateCommandSpecs,
  verifyEvidenceGates,
  type GateName,
} from './lib/evidence-runtime.ts';
import {
  loadSkillEvidencePolicy,
  requiredSkillEvidenceGates,
  validateSkillEvidenceCoverage,
} from './lib/skill-evidence-runtime.ts';
import { loadSkillPlan } from './lib/skill-plan-runtime.ts';
import { resolveRuntimeRelative, resolveRuntimeRoots } from './lib/runtime-roots.ts';
import {
  loadContextCapabilities,
  loadSkillCatalog,
  resolveSkillIds,
  validateSkillContextCapabilities,
} from './lib/skill-runtime.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const ROOT = roots.projectRoot;
const SKILLS_DIR = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_SKILLS_DIR, '.harness/skills');
const CAPABILITY_REGISTRY = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_CONTEXT_CAPABILITIES, '.harness/context/capabilities.yaml');
const POLICY_PATH = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_SKILL_EVIDENCE_POLICY, '.harness/policies/skill-evidence.yaml');
const gateSpecs = resolveGateCommandSpecs(roots.runtimeRoot, roots.projectRoot);
const expectedCommands = Object.fromEntries(ALL_GATES.map(gate=>[gate,gateSpecs[gate].command])) as Record<GateName,string>;

function fail(message: string): never {
  console.error(`Skill Evidence FAIL: ${message}`);
  process.exit(1);
}
function sameArray(a: string[] | undefined, b: string[]): boolean {
  return Boolean(a && a.length === b.length && a.every((value,index)=>value===b[index]));
}

const args = process.argv.slice(2);
try {
  const catalog = loadSkillCatalog(SKILLS_DIR);
  const capabilities = loadContextCapabilities(CAPABILITY_REGISTRY);
  validateSkillContextCapabilities(catalog, capabilities);
  const policy = loadSkillEvidencePolicy(POLICY_PATH);
  validateSkillEvidenceCoverage(catalog, policy);

  if (args.length === 1 && args[0] === '--check-policy') {
    console.log(`Skill Evidence Policy PASS: ${policy.verificationSkills.size} verification Skill mapping(s) cover the catalog`);
    process.exit(0);
  }

  const taskId = args[0];
  if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || args[1] !== '--verify' || args.length !== 2) {
    console.error('Usage: node .harness/scripts/skill-evidence.ts --check-policy');
    console.error('   or: node .harness/scripts/skill-evidence.ts <TASK_ID> --verify');
    process.exit(1);
  }

  const taskDir = path.join(roots.projectWipDir, taskId);
  if (!fs.existsSync(taskDir)) fail(`task not found: ${taskId}`);
  loadClassification(path.join(taskDir, 'classification.yaml'), taskId);
  const plan = loadSkillPlan(path.join(taskDir, 'skill-plan.yaml'), taskId, true);
  const resolved = resolveSkillIds(plan.selected, catalog);
  if (!sameArray(plan.resolved, resolved)) fail(`skill-plan resolved skills are stale; expected: ${resolved.join(' -> ')}`);

  const requirements = requiredSkillEvidenceGates(resolved, catalog, policy);
  if (requirements.gates.length === 0) {
    console.log(`Skill Evidence PASS for ${taskId}: no verification Skill requires machine evidence`);
    process.exit(0);
  }

  const evidencePath = path.join(taskDir, 'evidence.json');
  const loaded = loadEvidenceFile(taskId, evidencePath);
  if (loaded.legacyV1) fail('v1.0 evidence is stale by definition; recapture machine gates for v1.1');
  const current = repositorySnapshot(ROOT, evidenceExclusions(ROOT, taskDir));
  const statuses = verifyEvidenceGates(loaded.evidence, current, requirements.gates, expectedCommands);
  let failed = false;

  for (const [skillId, gates] of requirements.bySkill.entries()) {
    for (const gate of gates) {
      const status = statuses.get(gate);
      if (status === 'fresh') console.log(`Skill Evidence ${skillId} -> ${gate}: fresh PASS evidence present`);
      else if (status === 'stale') {
        failed = true;
        console.error(`Skill Evidence ${skillId} -> ${gate}: stale evidence; repository changed after gate execution`);
      } else {
        failed = true;
        console.error(`Skill Evidence ${skillId} -> ${gate}: missing or failing evidence`);
      }
    }
  }
  if (failed) process.exit(1);
  console.log(`Skill Evidence PASS for ${taskId}: ${requirements.gates.join(', ')}`);
} catch (error) {
  fail((error as Error).message);
}
