#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { independentReviewPaths, independentReviewSnapshot } from './lib/independent-review-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

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

interface ReviewFinding {
  id?: unknown;
  category?: unknown;
  severity?: unknown;
  summary?: unknown;
  evidence?: unknown;
  recommendation?: unknown;
}

const REVIEW_VERDICTS = ['READY', 'READY_WITH_FINDINGS', 'NOT_READY'] as const;
const FINDING_CATEGORIES = ['defect', 'risk', 'edge-case', 'optimization', 'question'] as const;
const FINDING_SEVERITIES = ['blocking', 'major', 'minor', 'suggestion'] as const;

const roots = resolveRuntimeRoots(import.meta.url);
const ROOT = roots.projectRoot;
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

const taskDir = path.join(roots.projectWipDir, taskId);
const { review: reviewPath, packet: packetPath } = independentReviewPaths(ROOT, taskDir);
const governancePath = path.join(roots.runtimeHarnessDir, 'governance.yaml');
function independentReviewMode(): string {
  const state = parseYaml(fs.readFileSync(path.join(taskDir, '.state.yaml'), 'utf8')) as { risk_level?: unknown };
  const governance = parseYaml(fs.readFileSync(governancePath, 'utf8')) as {
    default_risk_level?: unknown;
    risk_levels?: Record<string, { independent_review?: unknown }>;
  };
  const risk = String(state.risk_level ?? governance.default_risk_level ?? 'L2');
  const configured = governance.risk_levels?.[risk]?.independent_review;
  if (configured !== 'none' && configured !== 'codex-or-human' && configured !== 'human') {
    throw new Error(`invalid independent_review policy for risk ${risk}`);
  }
  return configured;
}

if (!fs.existsSync(taskDir)) { console.error(`Task not found: ${taskId}`); process.exit(1); }
let reviewMode: string;
try { reviewMode = independentReviewMode(); }
catch (error) { console.error(`Independent review FAIL: ${(error as Error).message}`); process.exit(1); }

if (reviewMode === 'none') {
  console.log(`Independent review not required for ${taskId}.`);
  process.exit(0);
}

if (mode === '--prepare') {
  const snapshot = independentReviewSnapshot(ROOT, taskDir);
  const sources = ['spec.md', 'plan.md', 'tasks.md', 'test-plan.md', 'changelog.md']
    .map(file => {
      const source = path.relative(ROOT, path.join(taskDir, file)).replaceAll('\\', '/');
      return `- ${source}${fs.existsSync(path.join(taskDir, file)) ? '' : ' (missing)'}`;
    })
    .join('\n');
  const reviewerInstruction = reviewMode === 'human'
    ? 'This task is high-risk and requires a HUMAN reviewer.'
    : 'Review this task in a FRESH Codex context or use a human reviewer. Do not reuse the builder conversation.';
  const packet = `# Independent Review Packet — ${taskId}\n\nRepository snapshot:\n- commit: ${snapshot.commit_sha}\n- worktree: ${snapshot.worktree_sha256}\n\n${reviewerInstruction} Challenge correctness, acceptance criteria, regressions, root-cause quality, and test adequacy. Record version=1.1 in independent-review.json with a reviewer session id distinct from the builder session id and this exact repository snapshot. Use verdict=READY when there are no findings, READY_WITH_FINDINGS for non-blocking findings, or NOT_READY when a blocking finding exists. Classify every finding with category=defect|risk|edge-case|optimization|question and severity=blocking|major|minor|suggestion.\n\n## Reviewer write boundary\n\nReviewer may write only independent-review.json. Reviewer must not modify product code, task planning, Context, Evidence, or other Builder artifacts. Review reports findings; it never starts Repair. If any prerequisite is stale or missing, stop and return it to the Builder. Do not run the mutating delivery gate.\n\n## Artifact sources\n\nRead these source files directly; their bodies are not duplicated in this packet:\n\n${sources}\n`;
  fs.writeFileSync(packetPath, packet);
  console.log(`Prepared ${path.relative(ROOT, packetPath)} (${reviewMode}).`);
  process.exit(0);
}

if (!fs.existsSync(reviewPath)) {
  console.error('Independent review record missing. Prepare a review packet and have the required reviewer produce independent-review.json.');
  process.exit(1);
}
let review: ReviewRecord;
try { review = JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as ReviewRecord; }
catch { console.error('Independent review record is invalid JSON.'); process.exit(1); }

const current = independentReviewSnapshot(ROOT, taskDir);
const reviewerKind = review.reviewer?.kind;
const reviewerSession = typeof review.reviewer?.session_id === 'string' ? review.reviewer.session_id.trim() : '';
const builderSession = typeof review.builder?.session_id === 'string' ? review.builder.session_id.trim() : '';
const repo = review.repository;
const failures: string[] = [];
if (review.version !== '1.0' && review.version !== '1.1') failures.push('version must be 1.0 or 1.1');
if (review.task_id !== taskId) failures.push('task_id mismatch');
if (reviewerKind !== 'codex-fresh-context' && reviewerKind !== 'human') failures.push('reviewer.kind must be codex-fresh-context or human');
if (reviewMode === 'human' && reviewerKind !== 'human') failures.push('risk policy requires reviewer.kind=human');
if (!reviewerSession) failures.push('reviewer.session_id is required');
if (!builderSession) failures.push('builder.session_id is required');
if (reviewerSession && builderSession && reviewerSession === builderSession) failures.push('reviewer session must differ from builder session');
if (!Array.isArray(review.findings)) failures.push('findings must be an array');
if (typeof review.reviewed_at !== 'string' || !review.reviewed_at.trim()) failures.push('reviewed_at is required');
if (repo?.commit_sha !== current.commit_sha || repo?.worktree_sha256 !== current.worktree_sha256) failures.push('independent review is stale for the current repository snapshot');
if (review.version === '1.0') {
  if (review.verdict !== 'PASS' && review.verdict !== 'REJECT') failures.push('v1.0 verdict must be PASS or REJECT');
} else if (review.version === '1.1') {
  if (!REVIEW_VERDICTS.includes(review.verdict as typeof REVIEW_VERDICTS[number])) {
    failures.push('v1.1 verdict must be READY, READY_WITH_FINDINGS, or NOT_READY');
  }
  const findings = Array.isArray(review.findings) ? review.findings as ReviewFinding[] : [];
  const ids = new Set<string>();
  for (const [index, finding] of findings.entries()) {
    const label = `findings[${index}]`;
    const id = typeof finding?.id === 'string' ? finding.id.trim() : '';
    if (!id) failures.push(`${label}.id is required`);
    else if (ids.has(id)) failures.push(`${label}.id must be unique`);
    else ids.add(id);
    if (!FINDING_CATEGORIES.includes(finding?.category as typeof FINDING_CATEGORIES[number])) failures.push(`${label}.category is invalid`);
    if (!FINDING_SEVERITIES.includes(finding?.severity as typeof FINDING_SEVERITIES[number])) failures.push(`${label}.severity is invalid`);
    for (const field of ['summary', 'evidence', 'recommendation'] as const) {
      if (typeof finding?.[field] !== 'string' || !finding[field].trim()) failures.push(`${label}.${field} is required`);
    }
  }
  const blocking = findings.some(finding => finding?.severity === 'blocking');
  if (findings.length === 0 && review.verdict !== 'READY') failures.push('a review without findings must use READY');
  if (findings.length > 0 && !blocking && review.verdict !== 'READY_WITH_FINDINGS') failures.push('non-blocking findings require READY_WITH_FINDINGS');
  if (blocking && review.verdict !== 'NOT_READY') failures.push('a blocking finding requires NOT_READY');
}
if (failures.length) { for (const failure of failures) console.error(`Independent review FAIL: ${failure}`); process.exit(1); }
const normalizedVerdict = review.version === '1.0'
  ? (review.verdict === 'PASS' ? 'READY' : 'NOT_READY')
  : String(review.verdict);
console.log(`Independent review COMPLETE for ${taskId}: ${normalizedVerdict} (${String(reviewerKind)}, policy ${reviewMode}).`);
