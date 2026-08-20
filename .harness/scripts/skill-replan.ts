#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadClassification } from './lib/classification-runtime.ts';
import { loadContextCapabilities, loadSkillCatalog, resolveSkillIds, validateSkillContextCapabilities } from './lib/skill-runtime.ts';
import { loadSkillPlan } from './lib/skill-plan-runtime.ts';
import {
  buildSkillReplanCheckpoint,
  skillReplanPath,
  verifySkillReplanCheckpoint,
  type SkillReplanDecision,
  type SkillReplanSource,
} from './lib/skill-replan-runtime.ts';
import { loadResyncReport } from './lib/resync-runtime.ts';
import { resolveRuntimeRelative, resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const args = process.argv.slice(2);
const taskId = args[0];
const mode = args[1];

function usage(): never {
  console.error('Usage: node .harness/scripts/skill-replan.ts <TASK_ID> --record <changed|unchanged> --source <codex|human>');
  console.error('   or: node .harness/scripts/skill-replan.ts <TASK_ID> --verify');
  process.exit(1);
}
function fail(message: string): never {
  console.error(`Skill Re-plan FAIL: ${message}`);
  process.exit(1);
}
function sameArray(a: string[] | undefined, b: string[]): boolean {
  return Boolean(a && a.length === b.length && a.every((value, index) => value === b[index]));
}

if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || !['--record', '--verify'].includes(mode ?? '')) usage();
const taskDir = path.join(roots.projectWipDir, taskId);
const planPath = path.join(taskDir, 'skill-plan.yaml');
if (!fs.existsSync(taskDir)) fail(`task not found: ${taskId}`);

try {
  loadClassification(path.join(taskDir, 'classification.yaml'), taskId);
  const skillsDir = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_SKILLS_DIR, '.harness/skills');
  const capabilityRegistry = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_CONTEXT_CAPABILITIES, '.harness/context/capabilities.yaml');
  const catalog = loadSkillCatalog(skillsDir);
  const capabilities = loadContextCapabilities(capabilityRegistry);
  validateSkillContextCapabilities(catalog, capabilities);
  const plan = loadSkillPlan(planPath, taskId, true);
  const expected = resolveSkillIds(plan.selected, catalog);
  if (!sameArray(plan.resolved, expected)) fail(`skill-plan resolved skills are stale; expected: ${expected.join(' -> ')}`);

  if (mode === '--verify') {
    if (args.length !== 2) usage();
    const checkpoint = verifySkillReplanCheckpoint(roots.projectRoot, taskId, planPath);
    console.log(`Skill Re-plan PASS for ${taskId}: ${checkpoint.decision} (${checkpoint.source}), ${checkpoint.skill_plan.selected.join(', ')}`);
    process.exit(0);
  }

  const decision = args[2] as SkillReplanDecision;
  const sourceIndex = args.indexOf('--source');
  const source = sourceIndex >= 0 ? args[sourceIndex + 1] as SkillReplanSource : undefined;
  if (!['changed', 'unchanged'].includes(decision) || !source || !['codex', 'human'].includes(source) || args.length !== 5 || sourceIndex !== 3) usage();
  const report = loadResyncReport(roots.projectRoot, taskId);
  if (!report) fail('Resync report missing; run resync.ts --prepare after detecting out-of-band changes');
  if (!report.requirements.skill_plan_review) fail('Resync report does not require Skill Plan review');

  const checkpoint = buildSkillReplanCheckpoint(report, plan, decision, source);
  const output = skillReplanPath(roots.projectRoot, taskId);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(checkpoint, null, 2)}\n`);
  console.log(`Skill Re-plan recorded for ${taskId}: ${decision} (${source}) -> ${plan.selected.join(', ')}`);
} catch (error) {
  fail((error as Error).message);
}
