#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ALL_GATES, type GateName } from './lib/evidence-runtime.ts';
import { loadSkillEvidencePolicy, requiredSkillEvidenceGates, validateSkillEvidenceCoverage } from './lib/skill-evidence-runtime.ts';
import { loadSkillPlan } from './lib/skill-plan-runtime.ts';
import { loadVerificationGapRegistry } from './lib/verification-gap-runtime.ts';
import { resolveRuntimeRelative, resolveRuntimeRoots } from './lib/runtime-roots.ts';
import { loadSkillCatalog } from './lib/skill-runtime.ts';
import { independentReviewPaths } from './lib/independent-review-runtime.ts';

interface Step { id: string; status: 'pass' | 'fail' | 'skip'; detail: string; }

const roots = resolveRuntimeRoots(import.meta.url);
const args = process.argv.slice(2);
const taskId = args.find(arg => !arg.startsWith('--'));
const json = args.includes('--json');
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error('Usage: node .harness/scripts/builder-finalize.ts <TASK_ID> [--json]');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const statePath = path.join(taskDir, '.state.yaml');
const steps: Step[] = [];

function detail(value: string): string {
  return (value.trim().split('\n').map(line => line.trim()).filter(Boolean).at(-1) ?? 'no diagnostic output').slice(0, 300);
}
function run(id: string, script: string, scriptArgs: string[], enabled = true): boolean {
  if (!enabled) {
    steps.push({ id, status: 'skip', detail: 'not required' });
    return true;
  }
  const result = spawnSync(process.execPath, [path.join(roots.runtimeHarnessDir, 'scripts', script), ...scriptArgs], {
    cwd: roots.projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_RUNTIME_ROOT: roots.runtimeRoot, ACLH_PROJECT_ROOT: roots.projectRoot },
  });
  const passed = result.status === 0;
  steps.push({ id, status: passed ? 'pass' : 'fail', detail: detail(passed ? result.stdout : `${result.stderr}\n${result.stdout}`) });
  return passed;
}
function finish(ok: boolean, browser: 'required-and-run' | 'not-required', builderReady = false, nextAction = 'fix-builder-finalize-failure'): never {
  const result = { version: '1.0', task_id: taskId, ok, browser, builder_ready: builderReady, next_action: nextAction, failures: steps.filter(step => step.status === 'fail').map(step => step.id), steps };
  if (json) console.log(JSON.stringify(result));
  else console.log(`Builder Finalize ${ok ? 'PASS' : 'FAIL'} for ${taskId}: browser=${browser}, builder_ready=${builderReady}, next=${nextAction}`);
  process.exit(ok ? 0 : 1);
}

if (!fs.existsSync(statePath)) {
  steps.push({ id: 'task', status: 'fail', detail: `task not found: ${taskId}` });
  finish(false, 'not-required');
}

try {
  const external = path.resolve(roots.runtimeRoot) !== path.resolve(roots.projectRoot);
  const skillPlanPath = path.join(taskDir, 'skill-plan.yaml');
  const p3 = fs.existsSync(skillPlanPath);
  let requiredGates = new Set<GateName>();
  const governance = parseYaml(fs.readFileSync(path.join(roots.runtimeHarnessDir, 'governance.yaml'), 'utf8')) as {
    default_risk_level?: unknown;
    risk_levels?: Record<string, { required_gates?: unknown }>;
  };
  const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as { risk_level?: unknown };
  const risk = String(state.risk_level ?? governance.default_risk_level ?? 'L2');
  const riskGates = governance.risk_levels?.[risk]?.required_gates;
  if (!Array.isArray(riskGates) || riskGates.some(gate => typeof gate !== 'string' || !ALL_GATES.includes(gate as GateName))) {
    throw new Error(`invalid required_gates for risk ${risk}`);
  }
  for (const gate of riskGates as GateName[]) requiredGates.add(gate);

  if (p3) {
    const plan = loadSkillPlan(skillPlanPath, taskId, true);
    const catalog = loadSkillCatalog(resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_SKILLS_DIR, '.harness/skills'));
    const policy = loadSkillEvidencePolicy(resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_SKILL_EVIDENCE_POLICY, '.harness/policies/skill-evidence.yaml'));
    validateSkillEvidenceCoverage(catalog, policy);
    for (const gate of requiredSkillEvidenceGates(plan.resolved ?? [], catalog, policy).gates) requiredGates.add(gate);
  }

  let requiresBrowser = false;
  if (external && p3) {
    const gaps = loadVerificationGapRegistry(path.join(taskDir, 'verification-gaps.yaml'), taskId);
    for (const entry of gaps.entries.filter(entry => entry.status === 'machine-covered')) {
      for (const gate of entry.machine_gates ?? []) requiredGates.add(gate);
      if (entry.machine_proofs?.includes('browser')) requiresBrowser = true;
    }
  }
  const browser = requiresBrowser ? 'required-and-run' : 'not-required';

  if (!run('verification-plan', 'verification-plan.ts', [taskId])) finish(false, browser);
  if (p3 && !run('skill-output', 'skill-output.ts', [taskId, '--verify'])) finish(false, browser);
  if (external && !run('context-scope', 'context-scope.ts', [taskId, '--generate'])) finish(false, browser);
  if (!run('context', 'context-select.ts', [taskId, '--generate'])) finish(false, browser);
  if (external && p3 && !run('verification-gaps-check', 'verification-gaps.ts', [taskId, '--check'])) finish(false, browser);
  if (requiresBrowser && !run('browser-verification', 'browser-verification.ts', [taskId, '--run'])) finish(false, browser);
  if (!requiresBrowser) run('browser-verification', 'browser-verification.ts', [taskId, '--run'], false);
  for (const gate of ALL_GATES.filter(item => requiredGates.has(item))) {
    if (!run(`evidence-${gate}`, 'evidence.ts', [taskId, '--gate', gate])) finish(false, browser);
  }
  if (!run('evidence', 'evidence.ts', [taskId, '--verify'])) finish(false, browser);
  if (p3 && !run('skill-evidence', 'skill-evidence.ts', [taskId, '--verify'])) finish(false, browser);
  if (external && p3 && !run('verification-gaps', 'verification-gaps.ts', [taskId, '--verify'])) finish(false, browser);

  const repairAuthorization = independentReviewPaths(roots.projectRoot, taskDir).repairAuthorization;
  if (fs.existsSync(repairAuthorization)) fs.unlinkSync(repairAuthorization);
  const statusResult = spawnSync(process.execPath, [path.join(roots.runtimeHarnessDir, 'scripts', 'task-status.ts'), taskId, '--json'], {
    cwd: roots.projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_RUNTIME_ROOT: roots.runtimeRoot, ACLH_PROJECT_ROOT: roots.projectRoot },
  });
  if (statusResult.status !== 0) {
    steps.push({ id: 'task-status', status: 'fail', detail: detail(`${statusResult.stderr}\n${statusResult.stdout}`) });
    finish(false, browser);
  }
  const status = JSON.parse(statusResult.stdout) as { builder_ready?: unknown; next_action?: unknown };
  const builderReady = status.builder_ready === true;
  steps.push({ id: 'task-status', status: builderReady ? 'pass' : 'fail', detail: `builder_ready=${String(status.builder_ready)}, next_action=${String(status.next_action)}` });
  finish(builderReady, browser, builderReady, String(status.next_action ?? 'unknown'));
} catch (error) {
  steps.push({ id: 'builder-finalize', status: 'fail', detail: (error as Error).message.slice(0, 300) });
  finish(false, 'not-required');
}
