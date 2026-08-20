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

interface RequirementUsage { requiredBy: Set<string>; optionalBy: Set<string>; }
type BootstrapActionKind = 'author-semantic-context' | 'initialize-empty-ledger' | 'repair-existing-source';

const roots = resolveRuntimeRoots(import.meta.url);
const args = process.argv.slice(2);
const taskId = args[0];
const mode = args[1];
const json = args.includes('--json');
if (
  !taskId ||
  !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) ||
  (mode !== '--plan' && mode !== '--prepare') ||
  args.some((arg, index) => index > 1 && arg !== '--json')
) {
  console.error('Usage: node .harness/scripts/context-bootstrap.ts <TASK_ID> --plan|--prepare [--json]');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const planPath = path.join(taskDir, 'skill-plan.yaml');
if (!fs.existsSync(planPath)) {
  console.error(`Context Bootstrap FAIL: skill-plan.yaml missing for ${taskId}`);
  process.exit(1);
}

function collectRequirements(resolved: string[], catalog: Map<string, SkillContract>): Map<string, RequirementUsage> {
  const requirements = new Map<string, RequirementUsage>();
  function usage(id: string): RequirementUsage {
    const existing = requirements.get(id);
    if (existing) return existing;
    const created = { requiredBy: new Set<string>(), optionalBy: new Set<string>() };
    requirements.set(id, created);
    return created;
  }
  for (const skillId of resolved) {
    const contract = catalog.get(skillId);
    if (!contract) throw new Error(`resolved skill missing from catalog: ${skillId}`);
    for (const id of contract.requires.context.required) usage(id).requiredBy.add(skillId);
    for (const id of contract.requires.context.optional) usage(id).optionalBy.add(skillId);
  }
  return requirements;
}

try {
  const catalog = loadSkillCatalog(path.join(roots.runtimeHarnessDir, 'skills'));
  const capabilities = loadContextCapabilities(path.join(roots.runtimeHarnessDir, 'context/capabilities.yaml'));
  validateSkillContextCapabilities(catalog, capabilities);
  const plan = loadSkillPlan(planPath, taskId, true);
  const resolved = resolveSkillIds(plan.selected, catalog);
  const requirements = collectRequirements(resolved, catalog);
  const projectDir = path.join(roots.projectRoot, '.harness/project');

  const actions = [...requirements.keys()].sort().flatMap(id => {
    const usage = requirements.get(id)!;
    if (usage.requiredBy.size === 0) return [];
    const capability = capabilities.get(id);
    if (!capability) throw new Error(`Context capability missing from registry: ${id}`);
    if (capability.resolver === 'changed-files') return [];
    const sourcePath = path.join(projectDir, capability.source!);
    const readiness = assessContextSource(id, capability, sourcePath);
    if (readiness.status === 'ready') return [];

    let kind: BootstrapActionKind;
    let safeAutomatic = false;
    if (capability.resolver === 'knowledge' && readiness.status === 'missing') {
      kind = 'initialize-empty-ledger';
      safeAutomatic = true;
    } else if (capability.resolver === 'project-file') {
      kind = 'author-semantic-context';
    } else {
      kind = 'repair-existing-source';
    }
    return [{
      id,
      kind,
      source: capability.source!,
      target: path.relative(roots.projectRoot, sourcePath).replaceAll('\\', '/'),
      status: readiness.status,
      reason: readiness.reason,
      required_by: [...usage.requiredBy].sort(),
      safe_automatic: safeAutomatic,
    }];
  });

  const initialized: string[] = [];
  if (mode === '--prepare') {
    for (const action of actions) {
      if (action.kind !== 'initialize-empty-ledger' || !action.safe_automatic) continue;
      const target = path.join(roots.projectRoot, action.target);
      if (fs.existsSync(target)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'entries: []\n');
      initialized.push(action.id);
    }
  }

  const result = {
    version: '1.0',
    task_id: taskId,
    mode: mode === '--prepare' ? 'prepare' : 'plan',
    actions,
    initialized,
    semantic_authoring_required: actions.filter(action => action.kind === 'author-semantic-context').map(action => action.id),
    manual_repair_required: actions.filter(action => action.kind === 'repair-existing-source').map(action => action.id),
  };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const action of actions) {
      console.log(`Context Bootstrap ${action.id}: ${action.kind} -> ${action.target} (${action.status})`);
    }
    for (const id of initialized) console.log(`Context Bootstrap initialized empty ledger: ${id}`);
    if (actions.length === 0) console.log(`Context Bootstrap: no required source bootstrap needed for ${taskId}.`);
  }
} catch (error) {
  console.error(`Context Bootstrap FAIL: ${(error as Error).message}`);
  process.exit(1);
}
