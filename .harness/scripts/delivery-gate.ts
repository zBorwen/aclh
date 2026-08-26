#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { loadResyncReport } from './lib/resync-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

interface RiskPolicy {
  context_required?: unknown;
  builder_self_review?: unknown;
  independent_review?: unknown;
}

const roots = resolveRuntimeRoots(import.meta.url);
const ROOT = roots.projectRoot;
const EXTERNAL_MODE = path.resolve(roots.runtimeRoot) !== path.resolve(ROOT);
const taskId = process.argv[2];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error('Usage: node .harness/scripts/delivery-gate.ts <TASK_ID>');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
if (!fs.existsSync(path.join(taskDir, '.state.yaml'))) {
  console.error(`Task not found or not initialized: ${taskId}`);
  process.exit(1);
}

const governance = parseYaml(fs.readFileSync(path.join(roots.runtimeHarnessDir, 'governance.yaml'), 'utf8')) as {
  default_risk_level?: unknown;
  risk_levels?: Record<string, RiskPolicy>;
};
const state = parseYaml(fs.readFileSync(path.join(taskDir, '.state.yaml'), 'utf8')) as { risk_level?: unknown };
const risk = String(state.risk_level ?? governance.default_risk_level ?? 'L2');
const policy = governance.risk_levels?.[risk];
if (!policy) {
  console.error(`Unknown risk level: ${risk}`);
  process.exit(1);
}

function run(script: string, args: string[]): void {
  const scriptPath = path.join(roots.runtimeHarnessDir, 'scripts', script);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      ACLH_RUNTIME_ROOT: roots.runtimeRoot,
      ACLH_PROJECT_ROOT: ROOT,
    },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function verifyContextBoundary(): void {
  if (EXTERNAL_MODE) run('context-scope.ts', [taskId, '--verify']);
  run('context-select.ts', [taskId, '--verify']);
}

const hasSkillPlan = fs.existsSync(path.join(taskDir, 'skill-plan.yaml'));
console.log(`[Delivery] ${taskId}: applying risk ${risk}${hasSkillPlan ? ' with P3 Skill Plan' : ' with P2 compatibility workflow'}`);
run('task-identity.ts', [taskId, '--verify']);

if (hasSkillPlan) {
  run('classification.ts', [taskId, '--verify']);
  run('skill-plan.ts', [taskId, '--verify']);
  const resync = loadResyncReport(ROOT, taskId);
  if (resync?.requirements.skill_plan_review === true) {
    run('skill-replan.ts', [taskId, '--verify']);
  }
  if (EXTERNAL_MODE) run('context-readiness.ts', [taskId, '--verify']);
  verifyContextBoundary();
  run('task-planning.ts', [taskId, '--verify']);
  run('verification-plan.ts', [taskId]);
  run('skill-output.ts', [taskId, '--verify']);
  if (EXTERNAL_MODE) run('verification-gaps.ts', [taskId, '--check']);
  run('evidence.ts', [taskId, '--verify']);
  run('skill-evidence.ts', [taskId, '--verify']);
  if (EXTERNAL_MODE) run('verification-gaps.ts', [taskId, '--verify']);
} else {
  if (policy.context_required === true) {
    verifyContextBoundary();
  } else {
    console.log(`[Delivery] ${taskId}: fresh task context not required by risk ${risk}`);
  }
  run('task-planning.ts', [taskId, '--verify']);
  run('verification-plan.ts', [taskId]);
  run('evidence.ts', [taskId, '--verify']);
}

if (policy.builder_self_review === true) {
  run('self-review.ts', [taskId, '--verify']);
} else {
  console.log(`[Delivery] ${taskId}: builder self-review not required by risk ${risk}`);
}

if (policy.independent_review === 'codex-or-human' || policy.independent_review === 'human') {
  run('independent-review.ts', [taskId, '--verify']);
  run('review-decision.ts', [taskId, '--require-accept']);
} else if (policy.independent_review === 'none') {
  console.log(`[Delivery] ${taskId}: independent review not required by risk ${risk}`);
} else {
  console.error(`[Delivery] ${taskId}: invalid independent_review policy`);
  process.exit(1);
}

run('managed-snapshot.ts', [taskId, '--record']);
console.log(`[Delivery] ${taskId}: PASS for risk ${risk}${hasSkillPlan ? ' / P3 Skill Plan' : ''}`);
