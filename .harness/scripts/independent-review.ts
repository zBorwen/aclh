#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

interface ReviewRecord {
  version?: unknown;
  task_id?: unknown;
  reviewer?: { kind?: unknown; session_id?: unknown };
  builder?: { session_id?: unknown };
  repository?: { commit_sha?: unknown; worktree_sha256?: unknown };
  reviewed_at?: unknown;
  verdict?: unknown;
  findings?: unknown;
  notes?: unknown;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const taskId = process.argv[2];
const mode = process.argv[3];

if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error('Usage: node .harness/scripts/independent-review.ts <TASK_ID> --prepare|--verify');
  process.exit(1);
}
if (mode !== '--prepare' && mode !== '--verify') {
  console.error('Expected --prepare or --verify.');
  process.exit(1);
}

const taskDir = path.join(ROOT, 'docs/wip', taskId);
const reviewPath = path.join(taskDir, 'independent-review.json');
const packetPath = path.join(taskDir, 'review-packet.md');
const evidencePath = path.join(taskDir, 'evidence.json');

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function repositorySnapshot(): { commit_sha: string; worktree_sha256: string } {
  const commitSha = git(['rev-parse', 'HEAD']);
  const tracked = git(['ls-files']).split('\n').filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  const excluded = new Set([
    path.relative(ROOT, reviewPath).replaceAll('\\', '/'),
    path.relative(ROOT, packetPath).replaceAll('\\', '/'),
    path.relative(ROOT, evidencePath).replaceAll('\\', '/'),
  ]);
  const files = [...new Set([...tracked, ...untracked])].filter(file => !excluded.has(file)).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const absolute = path.join(ROOT, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    hash.update(file); hash.update('\0'); hash.update(fs.readFileSync(absolute)); hash.update('\0');
  }
  return { commit_sha: commitSha, worktree_sha256: hash.digest('hex') };
}

if (!fs.existsSync(taskDir)) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

if (mode === '--prepare') {
  const snapshot = repositorySnapshot();
  const sections = ['spec.md', 'tasks.md', 'test-plan.md', 'changelog.md']
    .map(file => `## ${file}\n\n${fs.existsSync(path.join(taskDir, file)) ? fs.readFileSync(path.join(taskDir, file), 'utf8') : '(missing)'}`)
    .join('\n\n');
  const packet = `# Independent Review Packet — ${taskId}\n\nRepository snapshot:\n- commit: ${snapshot.commit_sha}\n- worktree: ${snapshot.worktree_sha256}\n\nReview this task in a FRESH Codex context. Do not reuse the builder conversation. Challenge correctness, acceptance criteria, regressions, root-cause quality, and test adequacy. Record the result in independent-review.json using reviewer.kind=codex-fresh-context (or human), a reviewer session id distinct from the builder session id, verdict=PASS|REJECT, findings as an array, and this exact repository snapshot.\n\n${sections}\n`;
  fs.writeFileSync(packetPath, packet);
  console.log(`Prepared ${path.relative(ROOT, packetPath)} for a fresh reviewer context.`);
  process.exit(0);
}

if (!fs.existsSync(reviewPath)) {
  console.error('Independent review record missing. Prepare a review packet and have a fresh Codex context or human reviewer produce independent-review.json.');
  process.exit(1);
}

let review: ReviewRecord;
try { review = JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as ReviewRecord; }
catch { console.error('Independent review record is invalid JSON.'); process.exit(1); }

const current = repositorySnapshot();
const reviewerKind = review.reviewer?.kind;
const reviewerSession = typeof review.reviewer?.session_id === 'string' ? review.reviewer.session_id.trim() : '';
const builderSession = typeof review.builder?.session_id === 'string' ? review.builder.session_id.trim() : '';
const repo = review.repository;
const failures: string[] = [];
if (review.version !== '1.0') failures.push('version must be 1.0');
if (review.task_id !== taskId) failures.push('task_id mismatch');
if (reviewerKind !== 'codex-fresh-context' && reviewerKind !== 'human') failures.push('reviewer.kind must be codex-fresh-context or human');
if (!reviewerSession) failures.push('reviewer.session_id is required');
if (!builderSession) failures.push('builder.session_id is required');
if (reviewerSession && builderSession && reviewerSession === builderSession) failures.push('reviewer session must differ from builder session');
if (review.verdict !== 'PASS') failures.push('independent review verdict must be PASS');
if (!Array.isArray(review.findings)) failures.push('findings must be an array');
if (typeof review.reviewed_at !== 'string' || !review.reviewed_at.trim()) failures.push('reviewed_at is required');
if (repo?.commit_sha !== current.commit_sha || repo?.worktree_sha256 !== current.worktree_sha256) failures.push('independent review is stale for the current repository snapshot');

if (failures.length) {
  for (const failure of failures) console.error(`Independent review FAIL: ${failure}`);
  process.exit(1);
}
console.log(`Independent review PASS for ${taskId} (${String(reviewerKind)}).`);
