#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const CONTRACT = 'spec-plan-tasks-v1';
const roots = resolveRuntimeRoots(import.meta.url);
const taskId = process.argv[2];
const mode = process.argv[3];

if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || mode !== '--verify') {
  console.error('Usage: node .harness/scripts/task-planning.ts <TASK_ID> --verify');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const statePath = path.join(taskDir, '.state.yaml');
if (!fs.existsSync(statePath)) {
  console.error(`Planning FAIL: task not found: ${taskId}`);
  process.exit(1);
}

const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as {
  planning?: { contract?: unknown };
};
const declared = state.planning?.contract;
if (declared === undefined) {
  console.log(`Planning not required for legacy task ${taskId}.`);
  process.exit(0);
}
if (declared !== CONTRACT) {
  console.error(`Planning FAIL: unsupported planning contract: ${String(declared)}`);
  process.exit(1);
}

const requirements: Record<string, string[]> = {
  'spec.md': ['Problem', 'User Scenarios', 'Functional Requirements', 'Acceptance Criteria', 'Edge Cases', 'Out of Scope'],
  'plan.md': ['Technical Context', 'Architecture', 'Data Model and Contracts', 'Implementation Strategy', 'Verification Strategy', 'Risks and Mitigations'],
  'tasks.md': ['Implementation Tasks', 'Dependencies', 'Verification Tasks', 'Acceptance Mapping'],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionBody(document: string, heading: string): string | null {
  const pattern = new RegExp(`^## ${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  const match = document.match(pattern);
  return match ? match[1].replace(/<!--([\s\S]*?)-->/g, '').trim() : null;
}

const failures: string[] = [];
for (const [file, sections] of Object.entries(requirements)) {
  const filePath = path.join(taskDir, file);
  if (!fs.existsSync(filePath)) {
    failures.push(`${file} is missing`);
    continue;
  }
  const document = fs.readFileSync(filePath, 'utf8');
  if (/\[(?:Task title|TASK-ID)\]|Replace this placeholder|<!--\s*REQUIRED:/i.test(document)) {
    failures.push(`${file} contains an untouched placeholder`);
  }
  for (const section of sections) {
    const body = sectionBody(document, section);
    if (body === null) failures.push(`${file} is missing section: ${section}`);
    else if (body.length < 20) failures.push(`${file} section is incomplete: ${section}`);
  }
  if ((file === 'spec.md' || file === 'tasks.md') && !/^- \[[ xX]\] .+/m.test(document)) {
    failures.push(`${file} must contain at least one checklist item`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`Planning FAIL: ${failure}`);
  process.exit(1);
}
console.log(`Planning PASS for ${taskId}: spec.md -> plan.md -> tasks.md.`);
