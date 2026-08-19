#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  captureManagedSnapshot,
  isManagedSnapshotCurrent,
  loadManagedSnapshot,
  managedSnapshotExclusions,
  managedSnapshotPath,
} from './lib/managed-snapshot-runtime.ts';
import { resyncReportPath, type ResyncReport } from './lib/resync-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const args = process.argv.slice(2);
const taskId = args[0];
const mode = args[1];
const json = args.includes('--json');
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || mode !== '--prepare' || args.some((arg, index) => index > 1 && arg !== '--json')) {
  console.error('Usage: node .harness/scripts/resync.ts <TASK_ID> --prepare [--json]');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const statePath = path.join(taskDir, '.state.yaml');
if (!fs.existsSync(statePath)) {
  console.error(`Resync FAIL: task not found: ${taskId}`);
  process.exit(1);
}

function git(args: string[]): string {
  const result = spawnSync('git', args, { cwd: roots.projectRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}
function normalize(value: string): string { return value.replaceAll('\\', '/').replace(/^\.\//, ''); }
function filtered(files: string[], exclusions: Set<string>): string[] {
  return [...new Set(files.map(normalize).filter(Boolean).filter(file => !exclusions.has(file)))].sort();
}
function diffFiles(from: string, to?: string): string[] {
  const args = ['diff', '--name-only', from];
  if (to) args.push(to);
  args.push('--');
  const output = git(args);
  return output ? output.split('\n') : [];
}
function untrackedFiles(): string[] {
  const output = git(['ls-files', '--others', '--exclude-standard']);
  return output ? output.split('\n') : [];
}
function evidenceHasGates(): boolean {
  const file = path.join(taskDir, 'evidence.json');
  if (!fs.existsSync(file)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { gates?: unknown };
    return Boolean(parsed.gates && typeof parsed.gates === 'object' && Object.keys(parsed.gates as object).length > 0);
  } catch { return true; }
}

try {
  const managedFile = managedSnapshotPath(roots.projectRoot, taskId);
  const recorded = loadManagedSnapshot(managedFile, taskId);
  const reportFile = resyncReportPath(roots.projectRoot, taskId);
  if (!recorded) {
    const result = { task_id: taskId, status: 'unknown', reason: 'managed snapshot missing' };
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.log(`Resync UNKNOWN for ${taskId}: record a managed checkpoint before resynchronizing.`);
    process.exit(3);
  }

  const current = captureManagedSnapshot(roots.projectRoot, taskDir);
  if (isManagedSnapshotCurrent(recorded, current)) {
    if (fs.existsSync(reportFile)) fs.rmSync(reportFile, { force: true });
    const result = { task_id: taskId, status: 'clean' };
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.log(`Resync CLEAN for ${taskId}: no out-of-band repository change detected.`);
    process.exit(0);
  }

  const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as {
    identity?: { base_commit?: unknown };
    self_review?: { run_at?: unknown };
  };
  const baseCommit = typeof state.identity?.base_commit === 'string' ? state.identity.base_commit : '';
  if (!/^[0-9a-f]{40}$/.test(baseCommit)) throw new Error('task identity.base_commit is missing or invalid');
  const exclusions = new Set(managedSnapshotExclusions(roots.projectRoot, taskDir));

  const currentTaskChanges = filtered([...diffFiles(baseCommit), ...untrackedFiles()], exclusions);
  let committedSinceCheckpoint: string[] = [];
  if (recorded.repository.commit_sha !== current.commit_sha) {
    try { committedSinceCheckpoint = filtered(diffFiles(recorded.repository.commit_sha, 'HEAD'), exclusions); }
    catch { committedSinceCheckpoint = []; }
  }
  const currentWorktreeFiles = filtered([...diffFiles('HEAD'), ...untrackedFiles()], exclusions);

  const report: ResyncReport = {
    version: '1.0',
    task_id: taskId,
    status: 'changed',
    detected_at: new Date().toISOString(),
    managed: {
      recorded_at: recorded.recorded_at,
      commit_sha: recorded.repository.commit_sha,
      worktree_sha256: recorded.repository.worktree_sha256,
    },
    current,
    changes: {
      current_task_change_set: currentTaskChanges,
      committed_since_checkpoint: committedSinceCheckpoint,
      current_worktree_files: currentWorktreeFiles,
    },
    requirements: {
      preserve_classification: true,
      skill_plan_review: fs.existsSync(path.join(taskDir, 'skill-plan.yaml')),
      context_refresh: fs.existsSync(path.join(taskDir, 'context.json')),
      evidence_refresh: evidenceHasGates(),
      self_review_refresh: typeof state.self_review?.run_at === 'string' && state.self_review.run_at.trim().length > 0,
      independent_review_refresh: fs.existsSync(path.join(taskDir, 'independent-review.json')),
    },
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Resync PREPARED for ${taskId}: ${currentTaskChanges.length} current task change(s).`);
    console.log(`  Skill Plan review: ${report.requirements.skill_plan_review ? 'required' : 'not applicable'}`);
    console.log(`  Context refresh: ${report.requirements.context_refresh ? 'required' : 'not yet generated'}`);
    console.log(`  Evidence refresh: ${report.requirements.evidence_refresh ? 'required' : 'not yet recorded'}`);
    console.log('  Classification: preserve current Task classification');
  }
} catch (error) {
  console.error(`Resync FAIL: ${(error as Error).message}`);
  process.exit(1);
}
