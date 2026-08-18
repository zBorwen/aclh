#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

interface RiskPolicy {
  builder_self_review?: unknown;
  independent_review?: unknown;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const taskId = process.argv[2];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error('Usage: node .harness/scripts/delivery-gate.ts <TASK_ID>');
  process.exit(1);
}

const taskDir = path.join(ROOT, 'docs/wip', taskId);
if (!fs.existsSync(path.join(taskDir, '.state.yaml'))) {
  console.error(`Task not found or not initialized: ${taskId}`);
  process.exit(1);
}

const governance = parseYaml(fs.readFileSync(path.join(ROOT, '.harness/governance.yaml'), 'utf8')) as {
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
  const result = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`[Delivery] ${taskId}: applying risk ${risk}`);
run('.harness/scripts/verification-plan.ts', [taskId]);
run('.harness/scripts/evidence.ts', [taskId, '--verify']);

if (policy.builder_self_review === true) {
  run('.harness/scripts/self-review.ts', [taskId]);
} else {
  console.log(`[Delivery] ${taskId}: builder self-review not required by risk ${risk}`);
}

if (policy.independent_review === 'codex-or-human' || policy.independent_review === 'human') {
  run('.harness/scripts/independent-review.ts', [taskId, '--verify']);
} else if (policy.independent_review === 'none') {
  console.log(`[Delivery] ${taskId}: independent review not required by risk ${risk}`);
} else {
  console.error(`[Delivery] ${taskId}: invalid independent_review policy`);
  process.exit(1);
}

console.log(`[Delivery] ${taskId}: PASS for risk ${risk}`);
