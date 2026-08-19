#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  captureManagedSnapshot,
  isManagedSnapshotCurrent,
  loadManagedSnapshot,
  managedSnapshotPath,
  type ManagedSnapshotFile,
} from './lib/managed-snapshot-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const args = process.argv.slice(2);
const taskId = args[0];
const mode = args[1];
const json = args.includes('--json');
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || !['--record', '--status'].includes(mode ?? '')) {
  console.error('Usage: node .harness/scripts/managed-snapshot.ts <TASK_ID> --record');
  console.error('   or: node .harness/scripts/managed-snapshot.ts <TASK_ID> --status [--json]');
  process.exit(1);
}
if ((mode === '--record' && args.length !== 2) || (mode === '--status' && args.some((arg, index) => index > 1 && arg !== '--json'))) {
  console.error('Managed Snapshot FAIL: invalid arguments');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
if (!fs.existsSync(path.join(taskDir, '.state.yaml'))) {
  console.error(`Managed Snapshot FAIL: task not found: ${taskId}`);
  process.exit(1);
}

try {
  const output = managedSnapshotPath(roots.projectRoot, taskId);
  if (mode === '--record') {
    const record: ManagedSnapshotFile = {
      version: '1.0',
      task_id: taskId,
      repository: captureManagedSnapshot(roots.projectRoot, taskDir),
      recorded_at: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`Managed Snapshot recorded for ${taskId}: ${record.repository.commit_sha.slice(0, 12)} / ${record.repository.worktree_sha256.slice(0, 12)}`);
    process.exit(0);
  }

  const recorded = loadManagedSnapshot(output, taskId);
  if (!recorded) {
    const result = { task_id: taskId, status: 'unknown', reason: 'managed snapshot missing' };
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.log(`Managed Snapshot UNKNOWN for ${taskId}: no managed checkpoint exists.`);
    process.exit(3);
  }

  const current = captureManagedSnapshot(roots.projectRoot, taskDir);
  const clean = isManagedSnapshotCurrent(recorded, current);
  const result = {
    task_id: taskId,
    status: clean ? 'clean' : 'changed',
    recorded_at: recorded.recorded_at,
    commit_changed: recorded.repository.commit_sha !== current.commit_sha,
    worktree_changed: recorded.repository.worktree_sha256 !== current.worktree_sha256,
    recorded: recorded.repository,
    current,
  };
  if (json) console.log(JSON.stringify(result, null, 2));
  else if (clean) console.log(`Managed Snapshot CLEAN for ${taskId}: repository matches the last ACLH-managed checkpoint.`);
  else console.log(`Managed Snapshot CHANGED for ${taskId}: repository changed since the last ACLH-managed checkpoint.`);
  process.exit(clean ? 0 : 2);
} catch (error) {
  console.error(`Managed Snapshot FAIL: ${(error as Error).message}`);
  process.exit(1);
}
