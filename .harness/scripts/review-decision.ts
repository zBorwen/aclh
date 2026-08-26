#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { independentReviewPaths, independentReviewSnapshot } from './lib/independent-review-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

interface ReviewRecord {
  version?: unknown;
  verdict?: unknown;
  findings?: Array<{ id?: unknown }>;
}

interface DecisionRecord {
  version?: unknown;
  task_id?: unknown;
  decision?: unknown;
  findings?: unknown;
  decided_at?: unknown;
  source?: unknown;
  review_sha256?: unknown;
  repository?: { commit_sha?: unknown; worktree_sha256?: unknown };
}

const roots = resolveRuntimeRoots(import.meta.url);
const taskId = process.argv[2];
const mode = process.argv[3];
const selection = process.argv.slice(4);

if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)
  || !['--accept', '--repair', '--verify', '--require-accept'].includes(mode ?? '')) {
  console.error('Usage: node .harness/scripts/review-decision.ts <TASK_ID> --accept');
  console.error('   or: node .harness/scripts/review-decision.ts <TASK_ID> --repair [FINDING_ID ...|all]');
  console.error('   or: node .harness/scripts/review-decision.ts <TASK_ID> --verify|--require-accept');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const paths = independentReviewPaths(roots.projectRoot, taskDir);
if (!fs.existsSync(paths.review)) {
  console.error('Review decision FAIL: independent review is missing.');
  process.exit(1);
}

function verifyReview(): void {
  const result = spawnSync(process.execPath, [path.join(roots.runtimeHarnessDir, 'scripts', 'independent-review.ts'), taskId, '--verify'], {
    cwd: roots.projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ACLH_RUNTIME_ROOT: roots.runtimeRoot,
      ACLH_PROJECT_ROOT: roots.projectRoot,
    },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'Review decision FAIL: independent review is invalid.\n');
    process.exit(result.status ?? 1);
  }
}

function reviewDigest(): string {
  return createHash('sha256').update(fs.readFileSync(paths.review)).digest('hex');
}

function readReview(): ReviewRecord {
  return JSON.parse(fs.readFileSync(paths.review, 'utf8')) as ReviewRecord;
}

function loadDecision(): DecisionRecord {
  if (!fs.existsSync(paths.decision)) {
    console.error('Review decision FAIL: decision record is missing; report the review and wait for explicit user direction.');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(paths.decision, 'utf8')) as DecisionRecord;
  } catch {
    console.error('Review decision FAIL: decision record is invalid JSON.');
    process.exit(1);
  }
}

function archiveRepair(review: ReviewRecord, record: Record<string, unknown>): void {
  let history: unknown[] = [];
  if (fs.existsSync(paths.history)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(paths.history, 'utf8')) as { rounds?: unknown };
      if (Array.isArray(parsed.rounds)) history = parsed.rounds;
    } catch {
      console.error('Review decision FAIL: review-history.json is invalid JSON.');
      process.exit(1);
    }
  }
  history.push({ review, decision: record });
  fs.writeFileSync(paths.history, `${JSON.stringify({ version: '1.0', task_id: taskId, rounds: history }, null, 2)}\n`);
  fs.writeFileSync(paths.repairAuthorization, `${JSON.stringify(record, null, 2)}\n`);
  fs.unlinkSync(paths.review);
  fs.unlinkSync(paths.decision);
}

// A previously recorded explicit Repair remains authoritative after Builder edits
// make the reviewed repository snapshot stale. Rotate that round without asking the
// user to repeat the decision.
if (mode === '--repair' && fs.existsSync(paths.decision)) {
  const existing = loadDecision();
  if (existing.decision !== 'repair' || existing.source !== 'user-explicit'
    || !Array.isArray(existing.findings) || existing.findings.length === 0
    || existing.review_sha256 !== reviewDigest()) {
    console.error('Review decision FAIL: existing repair decision is invalid or stale for the review record.');
    process.exit(1);
  }
  archiveRepair(readReview(), existing as Record<string, unknown>);
  console.log(`Review decision resumed for ${taskId}: repair (${existing.findings.join(', ')}).`);
  process.exit(0);
}

verifyReview();
const review = readReview();
const snapshot = independentReviewSnapshot(roots.projectRoot, taskDir);

if (mode === '--accept' || mode === '--repair') {
  const findingIds = (Array.isArray(review.findings) ? review.findings : [])
    .map(finding => typeof finding.id === 'string' ? finding.id.trim() : '')
    .filter(Boolean);
  let selected: string[] = [];
  if (mode === '--repair') {
    selected = selection.length === 0 || selection.includes('all')
      ? findingIds
      : [...new Set(selection.flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean))];
    if (selected.length === 0) {
      console.error('Review decision FAIL: Repair requires at least one review finding.');
      process.exit(1);
    }
    const unknown = selected.filter(id => !findingIds.includes(id));
    if (unknown.length > 0) {
      console.error(`Review decision FAIL: unknown finding id(s): ${unknown.join(', ')}`);
      process.exit(1);
    }
  } else if (selection.length > 0) {
    console.error('Review decision FAIL: --accept does not take finding ids.');
    process.exit(1);
  }
  const record = {
    version: '1.0',
    task_id: taskId,
    decision: mode === '--accept' ? 'accept' : 'repair',
    findings: selected,
    decided_at: new Date().toISOString(),
    source: 'user-explicit',
    review_sha256: reviewDigest(),
    repository: snapshot,
  };
  fs.writeFileSync(paths.decision, `${JSON.stringify(record, null, 2)}\n`);
  if (mode === '--repair') {
    archiveRepair(review, record);
  }
  console.log(`Review decision recorded for ${taskId}: ${record.decision}${selected.length ? ` (${selected.join(', ')})` : ''}.`);
  process.exit(0);
}

const decision = loadDecision();
const failures: string[] = [];
if (decision.version !== '1.0') failures.push('version must be 1.0');
if (decision.task_id !== taskId) failures.push('task_id mismatch');
if (decision.decision !== 'accept' && decision.decision !== 'repair') failures.push('decision must be accept or repair');
if (!Array.isArray(decision.findings) || !decision.findings.every(id => typeof id === 'string' && id.trim())) failures.push('findings must be a string array');
if (decision.decision === 'accept' && Array.isArray(decision.findings) && decision.findings.length > 0) failures.push('accept decision must not select findings');
if (decision.decision === 'repair' && Array.isArray(decision.findings) && decision.findings.length === 0) failures.push('repair decision must select findings');
if (typeof decision.decided_at !== 'string' || !decision.decided_at.trim()) failures.push('decided_at is required');
if (decision.source !== 'user-explicit') failures.push('source must be user-explicit');
if (decision.review_sha256 !== reviewDigest()) failures.push('decision is stale for the current independent review');
if (decision.repository?.commit_sha !== snapshot.commit_sha || decision.repository?.worktree_sha256 !== snapshot.worktree_sha256) failures.push('decision is stale for the reviewed repository snapshot');
if (mode === '--require-accept' && decision.decision !== 'accept') failures.push('Delivery requires an explicit user accept decision');
if (failures.length > 0) {
  for (const failure of failures) console.error(`Review decision FAIL: ${failure}`);
  process.exit(1);
}
console.log(`Review decision PASS for ${taskId}: ${String(decision.decision)}.`);
