#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const taskId = process.argv[2];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error('Usage: node .harness/scripts/verification-plan.ts <TASK_ID>');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const statePath = path.join(taskDir, '.state.yaml');
const planPath = path.join(taskDir, 'test-plan.md');
if (!fs.existsSync(statePath) || !fs.existsSync(planPath)) {
  console.error(`Verification plan FAIL: task state or test-plan.md missing for ${taskId}`);
  process.exit(1);
}

const governance = parseYaml(fs.readFileSync(path.join(roots.runtimeHarnessDir, 'governance.yaml'), 'utf8')) as {
  default_verification_strategy?: unknown;
  verification_strategies?: Record<string, { required_markers?: unknown }>;
};
const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as { verification_strategy?: unknown };
const strategy = String(state.verification_strategy ?? governance.default_verification_strategy ?? 'tdd');
const config = governance.verification_strategies?.[strategy];
if (!config) {
  console.error(`Verification plan FAIL: unknown strategy ${strategy}`);
  process.exit(1);
}
const markers = Array.isArray(config.required_markers) ? config.required_markers.filter((m): m is string => typeof m === 'string') : [];
const plan = fs.readFileSync(planPath, 'utf8');
const declared = plan.match(/^strategy:\s*([^\s]+)\s*$/m)?.[1];
const failures: string[] = [];
if (declared !== strategy) failures.push(`test-plan strategy must equal state verification_strategy (${strategy})`);
for (const marker of markers) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const completed = new RegExp(`^- \\[x\\] ${escaped}:`, 'mi').test(plan);
  if (!completed) failures.push(`required verification marker not completed: ${marker}`);
}
if (failures.length) {
  for (const failure of failures) console.error(`Verification plan FAIL: ${failure}`);
  process.exit(1);
}
console.log(`Verification plan PASS for ${taskId} (${strategy}).`);
