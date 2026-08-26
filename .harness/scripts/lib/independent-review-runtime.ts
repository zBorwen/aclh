import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { RepositorySnapshot } from './evidence-runtime.ts';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function independentReviewPaths(root: string, taskDir: string): {
  review: string;
  packet: string;
  evidence: string;
  decision: string;
  repairAuthorization: string;
  history: string;
} {
  return {
    review: path.join(taskDir, 'independent-review.json'),
    packet: path.join(taskDir, 'review-packet.md'),
    evidence: path.join(taskDir, 'evidence.json'),
    decision: path.join(taskDir, 'review-decision.json'),
    repairAuthorization: path.join(taskDir, 'repair-authorization.json'),
    history: path.join(taskDir, 'review-history.json'),
  };
}

export function independentReviewSnapshot(root: string, taskDir: string): RepositorySnapshot {
  const paths = independentReviewPaths(root, taskDir);
  const commitSha = git(root, ['rev-parse', 'HEAD']);
  const tracked = git(root, ['ls-files']).split('\n').filter(Boolean);
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  const excluded = new Set(Object.values(paths).map(file => path.relative(root, file).replaceAll('\\', '/')));
  const files = [...new Set([...tracked, ...untracked])].filter(file => !excluded.has(file)).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    hash.update(file);
    hash.update('\0');
    hash.update(fs.readFileSync(absolute));
    hash.update('\0');
  }
  return { commit_sha: commitSha, worktree_sha256: hash.digest('hex') };
}

export function packetRepositorySnapshot(packet: string): RepositorySnapshot | null {
  const commitSha = packet.match(/^- commit: ([0-9a-f]{40})$/m)?.[1];
  const worktreeSha = packet.match(/^- worktree: ([0-9a-f]{64})$/m)?.[1];
  return commitSha && worktreeSha ? { commit_sha: commitSha, worktree_sha256: worktreeSha } : null;
}
