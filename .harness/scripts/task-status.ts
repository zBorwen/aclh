#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { sameSnapshot } from './lib/evidence-runtime.ts';
import {
  independentReviewPaths,
  independentReviewSnapshot,
  packetRepositorySnapshot,
} from './lib/independent-review-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

type CheckStatus = 'pass' | 'fail' | 'skip';
interface Check { id: string; status: CheckStatus; detail: string; }

const roots = resolveRuntimeRoots(import.meta.url);
const args = process.argv.slice(2);
const taskId = args.find(arg => !arg.startsWith('--'));
const json = args.includes('--json');
const requireReviewReady = args.includes('--review-ready');
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error('Usage: node .harness/scripts/task-status.ts <TASK_ID> [--json] [--review-ready]');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const statePath = path.join(taskDir, '.state.yaml');
if (!fs.existsSync(statePath)) {
  console.error(`Task status FAIL: task not found: ${taskId}`);
  process.exit(1);
}

const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as {
  phase?: unknown;
  status?: unknown;
  risk_level?: unknown;
  classification?: unknown;
  skill_plan?: unknown;
};
const governance = parseYaml(fs.readFileSync(path.join(roots.runtimeHarnessDir, 'governance.yaml'), 'utf8')) as {
  default_risk_level?: unknown;
  risk_levels?: Record<string, {
    context_required?: unknown;
    builder_self_review?: unknown;
    independent_review?: unknown;
  }>;
};
const risk = String(state.risk_level ?? governance.default_risk_level ?? 'L2');
const policy = governance.risk_levels?.[risk];
if (!policy) {
  console.error(`Task status FAIL: unknown risk level: ${risk}`);
  process.exit(1);
}

const checks: Check[] = [];
function boundedDetail(value: string): string {
  const lines = value.trim().split('\n').map(line => line.trim()).filter(Boolean);
  return (lines.at(-1) ?? 'no diagnostic output').slice(0, 300);
}
function run(id: string, script: string, scriptArgs: string[], enabled = true): boolean {
  if (!enabled) {
    checks.push({ id, status: 'skip', detail: 'not required' });
    return true;
  }
  const result = spawnSync(process.execPath, [path.join(roots.runtimeHarnessDir, 'scripts', script), ...scriptArgs], {
    cwd: roots.projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ACLH_RUNTIME_ROOT: roots.runtimeRoot,
      ACLH_PROJECT_ROOT: roots.projectRoot,
    },
  });
  const passed = result.status === 0;
  checks.push({
    id,
    status: passed ? 'pass' : 'fail',
    detail: boundedDetail(passed ? result.stdout : `${result.stderr}\n${result.stdout}`),
  });
  return passed;
}
function has(file: string): boolean { return fs.existsSync(path.join(taskDir, file)); }
function check(id: string): Check | undefined { return checks.find(item => item.id === id); }

const identity = run('task-identity', 'task-identity.ts', [taskId, '--verify']);
const hasSkillPlan = has('skill-plan.yaml');
const p3Task = hasSkillPlan || (state.skill_plan !== null && typeof state.skill_plan === 'object');
const classificationEnabled = p3Task && identity;
const classification = run('classification', 'classification.ts', [taskId, '--verify'], classificationEnabled);
const skillPlanEnabled = p3Task && identity && classificationEnabled && classification;
const skillPlan = run('skill-plan', 'skill-plan.ts', [taskId, '--verify'], skillPlanEnabled);
const bootstrapReady = identity && (!p3Task || (classificationEnabled && classification && skillPlanEnabled && skillPlan));
const external = path.resolve(roots.runtimeRoot) !== path.resolve(roots.projectRoot);
const contextRequired = policy.context_required === true || p3Task;
const readinessEnabled = external && bootstrapReady;
const readiness = run('context-readiness', 'context-readiness.ts', [taskId, '--verify'], readinessEnabled);
const scopeEnabled = external && bootstrapReady;
const scope = run('context-scope', 'context-scope.ts', [taskId, '--verify'], scopeEnabled);
const contextEnabled = contextRequired && bootstrapReady && (!external || (readiness && scope));
const context = run('context', 'context-select.ts', [taskId, '--verify'], contextEnabled);
const contextReady = !contextRequired || (contextEnabled && context);
const verificationPlanEnabled = contextReady;
const verificationPlan = run('verification-plan', 'verification-plan.ts', [taskId], verificationPlanEnabled);
const skillOutputEnabled = p3Task && contextReady;
const skillOutput = run('skill-output', 'skill-output.ts', [taskId, '--verify'], skillOutputEnabled);
const gapCheckEnabled = external && p3Task && contextReady;
const gapCheck = run('verification-gaps-check', 'verification-gaps.ts', [taskId, '--check'], gapCheckEnabled);
const preEvidenceReady = contextReady
  && verificationPlanEnabled && verificationPlan
  && (!p3Task || (skillOutputEnabled && skillOutput))
  && (!external || !p3Task || (gapCheckEnabled && gapCheck));
const evidenceEnabled = preEvidenceReady;
const evidence = run('evidence', 'evidence.ts', [taskId, '--verify'], evidenceEnabled);
const skillEvidenceEnabled = p3Task && evidenceEnabled && evidence;
const skillEvidence = run('skill-evidence', 'skill-evidence.ts', [taskId, '--verify'], skillEvidenceEnabled);
const gapVerifyEnabled = external && p3Task && skillEvidenceEnabled && skillEvidence;
const gapVerify = run('verification-gaps', 'verification-gaps.ts', [taskId, '--verify'], gapVerifyEnabled);
const builderChecksPass = bootstrapReady && contextReady && preEvidenceReady && evidenceEnabled && evidence
  && (!p3Task || (skillEvidenceEnabled && skillEvidence))
  && (!external || !p3Task || (gapVerifyEnabled && gapVerify));
const selfReview = run('self-review', 'self-review.ts', [taskId, '--verify'], policy.builder_self_review === true && builderChecksPass);
const builderReady = builderChecksPass && (policy.builder_self_review !== true || selfReview);

const reviewRequired = policy.independent_review === 'codex-or-human' || policy.independent_review === 'human';
const paths = independentReviewPaths(roots.projectRoot, taskDir);
let packetFresh = !reviewRequired;
if (reviewRequired && builderReady && fs.existsSync(paths.packet)) {
  const packet = packetRepositorySnapshot(fs.readFileSync(paths.packet, 'utf8'));
  packetFresh = packet !== null && sameSnapshot(packet, independentReviewSnapshot(roots.projectRoot, taskDir));
}
checks.push({
  id: 'review-packet',
  status: !reviewRequired || !builderReady ? 'skip' : packetFresh ? 'pass' : 'fail',
  detail: !reviewRequired ? 'not required' : !builderReady ? 'waiting for Builder prerequisites' : packetFresh ? 'fresh independent review packet' : 'missing or stale independent review packet',
});

const reviewExists = fs.existsSync(paths.review);
const independentReview = run(
  'independent-review',
  'independent-review.ts',
  [taskId, '--verify'],
  reviewRequired && builderReady && packetFresh && reviewExists,
);
const reviewComplete = !reviewRequired || (reviewExists && independentReview);
const reviewReady = reviewRequired && builderReady && packetFresh && !reviewExists;

let nextAction: string;
if (check('task-identity')?.status === 'fail') nextAction = 'repair-task-identity';
else if (p3Task && check('classification')?.status === 'fail') nextAction = 'author-or-fix-classification';
else if (p3Task && check('skill-plan')?.status === 'fail') nextAction = 'author-or-fix-skill-plan';
else if (!context) nextAction = 'generate-or-refresh-context';
else if (!verificationPlan || !skillOutput) nextAction = 'complete-task-and-skill-artifacts';
else if (!evidence || !skillEvidence || !gapVerify) nextAction = 'implement-and-record-evidence';
else if (policy.builder_self_review === true && !selfReview) nextAction = 'complete-builder-self-review';
else if (reviewRequired && !packetFresh) nextAction = 'prepare-independent-review';
else if (reviewReady) nextAction = 'run-independent-review';
else if (reviewRequired && !reviewComplete) nextAction = 'resolve-independent-review';
else nextAction = 'run-delivery-gate';

const result = {
  version: '1.0',
  task_id: taskId,
  phase: String(state.phase ?? ''),
  status: String(state.status ?? ''),
  risk_level: risk,
  builder_ready: builderReady,
  review_ready: reviewReady,
  review_complete: reviewComplete,
  next_action: nextAction,
  failures: checks.filter(item => item.status === 'fail').map(item => item.id),
  checks,
};

if (json) console.log(JSON.stringify(result));
else {
  console.log(`Task ${taskId}: next=${nextAction}, builder_ready=${builderReady}, review_ready=${reviewReady}`);
  for (const item of checks.filter(value => value.status === 'fail')) console.log(`  FAIL ${item.id}: ${item.detail}`);
}
process.exit(requireReviewReady && !reviewReady ? 2 : 0);
