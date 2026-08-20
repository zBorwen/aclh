import fs from 'node:fs';
import path from 'node:path';
import {
  evidenceExclusions,
  normalizeRepoPath,
  repositorySnapshot,
  sameSnapshot,
  type RepositorySnapshot,
} from './evidence-runtime.ts';

export interface BrowserVerificationRecord {
  version: '1.0';
  task_id: string;
  provider: 'npm-script';
  npm_script: 'test:browser';
  script_command: string;
  command: 'npm run test:browser';
  started_at: string;
  finished_at: string;
  exit_code: number;
  result: 'PASS' | 'FAIL';
  repository: RepositorySnapshot;
  repository_unchanged: boolean;
}

export type BrowserVerificationStatus = 'fresh' | 'missing' | 'stale';

export function browserVerificationPath(taskDir: string): string {
  return path.join(taskDir, 'browser-verification.json');
}

export function browserVerificationExclusions(root: string, taskDir: string): string[] {
  return [
    ...evidenceExclusions(root, taskDir),
    normalizeRepoPath(path.relative(root, browserVerificationPath(taskDir))),
  ];
}

export function browserRepositorySnapshot(root: string, taskDir: string): RepositorySnapshot {
  return repositorySnapshot(root, browserVerificationExclusions(root, taskDir));
}

export function loadBrowserVerification(file: string, taskId: string): BrowserVerificationRecord | null {
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<BrowserVerificationRecord>;
  if (
    parsed.version !== '1.0' ||
    parsed.task_id !== taskId ||
    parsed.provider !== 'npm-script' ||
    parsed.npm_script !== 'test:browser' ||
    parsed.command !== 'npm run test:browser' ||
    typeof parsed.script_command !== 'string' || parsed.script_command.trim().length === 0 ||
    typeof parsed.started_at !== 'string' ||
    typeof parsed.finished_at !== 'string' ||
    typeof parsed.exit_code !== 'number' ||
    (parsed.result !== 'PASS' && parsed.result !== 'FAIL') ||
    !parsed.repository ||
    typeof parsed.repository.commit_sha !== 'string' ||
    typeof parsed.repository.worktree_sha256 !== 'string' ||
    typeof parsed.repository_unchanged !== 'boolean'
  ) throw new Error('invalid browser verification schema');
  return parsed as BrowserVerificationRecord;
}

export function browserVerificationStatus(
  record: BrowserVerificationRecord | null,
  current: RepositorySnapshot,
  currentScriptCommand: string,
): BrowserVerificationStatus {
  if (
    !record ||
    record.result !== 'PASS' ||
    record.exit_code !== 0 ||
    record.repository_unchanged !== true ||
    record.script_command !== currentScriptCommand
  ) return 'missing';
  return sameSnapshot(record.repository, current) ? 'fresh' : 'stale';
}
