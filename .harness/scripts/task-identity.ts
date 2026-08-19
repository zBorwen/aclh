#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const ROOT = roots.projectRoot;
const taskId = process.argv[2];
const mode = process.argv[3] ?? '--verify';

if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error('Usage: node .harness/scripts/task-identity.ts <TASK_ID> [--verify|--bind-pr <NUMBER>]');
  process.exit(1);
}

const statePath = path.join(roots.projectWipDir, taskId, '.state.yaml');
if (!fs.existsSync(statePath)) {
  console.error(`Task identity FAIL: state missing for ${taskId}`);
  process.exit(1);
}

function git(args: string[]): string {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as {
  identity?: { branch?: unknown; base_commit?: unknown; pr_number?: unknown };
};
const identity = state.identity;
if (!identity || typeof identity !== 'object') {
  console.error('Task identity FAIL: identity block missing');
  process.exit(1);
}

if (mode === '--bind-pr') {
  const raw = process.argv[4];
  const pr = Number(raw);
  if (!Number.isInteger(pr) || pr <= 0) {
    console.error('Task identity FAIL: PR number must be a positive integer');
    process.exit(1);
  }
  identity.pr_number = pr;
  fs.writeFileSync(statePath, stringifyYaml(state));
  console.log(`Task ${taskId} bound to PR #${pr}.`);
  process.exit(0);
}

if (mode !== '--verify') {
  console.error('Expected --verify or --bind-pr <NUMBER>.');
  process.exit(1);
}

const expectedBranch = typeof identity.branch === 'string' ? identity.branch.trim() : '';
const baseCommit = typeof identity.base_commit === 'string' ? identity.base_commit.trim() : '';
const prNumber = identity.pr_number;
const failures: string[] = [];
if (!expectedBranch) failures.push('identity.branch is required');
if (!/^[0-9a-f]{40}$/.test(baseCommit)) failures.push('identity.base_commit must be a full commit SHA');

let currentBranch = '';
try {
  currentBranch = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_HEAD_REF
    ? process.env.GITHUB_HEAD_REF
    : git(['branch', '--show-current']);
} catch (error) {
  failures.push((error as Error).message);
}
if (!currentBranch) failures.push('cannot resolve current branch');
else if (expectedBranch && currentBranch !== expectedBranch) failures.push(`task belongs to branch ${expectedBranch}, current branch is ${currentBranch}`);

if (/^[0-9a-f]{40}$/.test(baseCommit)) {
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', baseCommit, 'HEAD'], { cwd: ROOT });
  if (ancestor.status !== 0) failures.push('identity.base_commit is not an ancestor of current HEAD');
}

if (prNumber !== null && prNumber !== undefined) {
  if (!Number.isInteger(prNumber) || Number(prNumber) <= 0) failures.push('identity.pr_number must be null or a positive integer');
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REF?.startsWith('refs/pull/')) {
    const actual = Number(process.env.GITHUB_REF.match(/^refs\/pull\/(\d+)\//)?.[1]);
    if (Number.isInteger(actual) && actual !== Number(prNumber)) failures.push(`task is bound to PR #${prNumber}, CI is running for PR #${actual}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`Task identity FAIL: ${failure}`);
  process.exit(1);
}
console.log(`Task identity PASS for ${taskId} (branch ${expectedBranch}, base ${baseCommit.slice(0, 12)}${prNumber ? `, PR #${prNumber}` : ''}).`);
