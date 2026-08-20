#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { captureManagedSnapshot, managedSnapshotPath, type ManagedSnapshotFile } from './lib/managed-snapshot-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const taskId = process.argv[2];
const mode = process.argv[3];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || mode !== '--record' || process.argv.length !== 4) {
  console.error('Usage: node .harness/scripts/managed-snapshot.ts <TASK_ID> --record');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
if (!fs.existsSync(path.join(taskDir, '.state.yaml'))) {
  console.error(`Managed Snapshot FAIL: task not found: ${taskId}`);
  process.exit(1);
}

try {
  const record: ManagedSnapshotFile = {
    version: '1.0',
    task_id: taskId,
    repository: captureManagedSnapshot(roots.projectRoot, taskDir),
    recorded_at: new Date().toISOString(),
  };
  const output = managedSnapshotPath(roots.projectRoot, taskId);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Managed Snapshot recorded for ${taskId}: ${record.repository.commit_sha.slice(0, 12)} / ${record.repository.worktree_sha256.slice(0, 12)}`);
} catch (error) {
  console.error(`Managed Snapshot FAIL: ${(error as Error).message}`);
  process.exit(1);
}
