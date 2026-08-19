import fs from 'node:fs';
import path from 'node:path';
import { normalizeRepoPath, repositorySnapshot, sameSnapshot, type RepositorySnapshot } from './evidence-runtime.ts';

export interface ManagedSnapshotFile {
  version: '1.0';
  task_id: string;
  repository: RepositorySnapshot;
  recorded_at: string;
}

export function managedSnapshotPath(taskDir: string): string {
  return path.join(taskDir, 'managed-snapshot.json');
}

export function managedSnapshotExclusions(root: string, taskDir: string): string[] {
  return [
    'context.json',
    'evidence.json',
    'review-packet.md',
    'independent-review.json',
    'managed-snapshot.json',
  ].map(name => normalizeRepoPath(path.relative(root, path.join(taskDir, name))));
}

export function captureManagedSnapshot(root: string, taskDir: string): RepositorySnapshot {
  return repositorySnapshot(root, managedSnapshotExclusions(root, taskDir));
}

export function loadManagedSnapshot(file: string, taskId: string): ManagedSnapshotFile | null {
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ManagedSnapshotFile>;
  if (
    parsed.version !== '1.0' ||
    parsed.task_id !== taskId ||
    !parsed.repository ||
    typeof parsed.repository.commit_sha !== 'string' ||
    typeof parsed.repository.worktree_sha256 !== 'string' ||
    typeof parsed.recorded_at !== 'string'
  ) {
    throw new Error('invalid managed snapshot schema');
  }
  return parsed as ManagedSnapshotFile;
}

export function isManagedSnapshotCurrent(recorded: ManagedSnapshotFile, current: RepositorySnapshot): boolean {
  return sameSnapshot(recorded.repository, current);
}
