#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { assessContextSource } from './lib/context-readiness-runtime.ts';
import { loadSkillPlan } from './lib/skill-plan-runtime.ts';
import {
  loadContextCapabilities,
  loadSkillCatalog,
  resolveSkillIds,
  validateSkillContextCapabilities,
  type SkillContract,
} from './lib/skill-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const args = process.argv.slice(2);
const taskId = args[0];
const verify = args.includes('--verify');
const json = args.includes('--json');
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || args.some((arg, index) => index > 0 && arg !== '--verify' && arg !== '--json')) {
  console.error('Usage: node .harness/scripts/context-readiness.ts <TASK_ID> [--verify] [--json]');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const planPath = path.join(taskDir, 'skill-plan.yaml');
if (!fs.existsSync(planPath)) {
  console.error(`Context Readiness FAIL: skill-plan.yaml missing for ${taskId}`);
  process.exit(1);
}

function collectRequirements(resolved: string[], catalog: Map<string, SkillContract>): Map<string, { requiredBy: Set<string>; optionalBy: Set<string> }> {
  const result = new Map<string, { requiredBy: Set<string>; optionalBy: Set<string> }>();
  function usage(id: string) {
    const existing = result.get(id);
    if (existing) return existing;
    const created = { requiredBy: new Set<string>(), optionalBy: new Set<string>() };
    result.set(id, created);
    return created;
  }
  for (const skillId of resolved) {
    const contract = catalog.get(skillId);
    if (!contract) throw new Error(`resolved skill missing from catalog: ${skillId}`);
    for (const id of contract.requires.context.required) usage(id).requiredBy.add(skillId);
    for (const id of contract.requires.context.optional) usage(id).optionalBy.add(skillId);
  }
  return result;
}

try {
  const skillsDir = path.join(roots.runtimeHarnessDir, 'skills');
  const registryPath = path.join(roots.runtimeHarnessDir, 'context/capabilities.yaml');
  const catalog = loadSkillCatalog(skillsDir);
  const capabilities = loadContextCapabilities(registryPath);
  validateSkillContextCapabilities(catalog, capabilities);
  const plan = loadSkillPlan(planPath, taskId, true);
  const resolved = resolveSkillIds(plan.selected, catalog);
  const requirements = collectRequirements(resolved, catalog);
  const sources = [...requirements.keys()].sort().map(id => {
    const usage = requirements.get(id)!;
    const capability = capabilities.get(id);
    if (!capability) throw new Error(`Context capability missing from registry: ${id}`);
    const sourcePath = capability.source ? path.join(roots.projectRoot, '.harness/project', capability.source) : undefined;
    const readiness = assessContextSource(id, capability, sourcePath);
    return {
      ...readiness,
      level: usage.requiredBy.size > 0 ? 'required' as const : 'optional' as const,
      required_by: [...usage.requiredBy].sort(),
      optional_by: [...usage.optionalBy].sort(),
    };
  });
  const blockers = sources.filter(item => item.level === 'required' && item.status !== 'ready');
  const report = {
    version: '1.0',
    task_id: taskId,
    skills: resolved,
    sources,
    ready: blockers.length === 0,
    blockers: blockers.map(item => item.id),
  };

  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const item of sources) {
      console.log(`Context Readiness ${item.id}: ${item.status} (${item.level}) - ${item.reason}`);
    }
    console.log(`Context Readiness ${report.ready ? 'PASS' : 'BLOCKED'} for ${taskId}.`);
  }
  if (verify && blockers.length > 0) process.exit(1);
} catch (error) {
  console.error(`Context Readiness FAIL: ${(error as Error).message}`);
  process.exit(1);
}
