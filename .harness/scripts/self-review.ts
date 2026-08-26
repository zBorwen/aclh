#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  evidenceExclusions,
  repositorySnapshot,
  sameSnapshot,
  type RepositorySnapshot,
} from './lib/evidence-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

interface TaskState {
  task_id?: unknown;
  updated_at?: unknown;
  phase?: unknown;
  status?: unknown;
  review_history?: unknown;
}
interface SelfReviewRecord {
  version?: unknown;
  task_id?: unknown;
  repository?: { commit_sha?: unknown; worktree_sha256?: unknown };
  run_at?: unknown;
  gaps_found?: unknown;
  root_fix_tracked?: unknown;
  notes?: unknown;
  answers?: unknown;
}
interface CheckResult {
  level: 'OK' | 'WARN' | 'MISS';
  label: string;
  detail: string;
}
interface ReviewReport {
  task: string;
  state: { phase: string; status: string; has_self_review: boolean };
  checks: CheckResult[];
  questions: string[];
  misses: number;
  warnings: number;
  result: 'PASS' | 'WARNINGS' | 'FAIL';
}

const roots = resolveRuntimeRoots(import.meta.url);
const ROOT = roots.projectRoot;
const WIP = roots.projectWipDir;
const README_LINK = path.join(roots.runtimeRoot, 'AGENTS.md');
const REQUIRED_FILES = ['spec.md', 'tasks.md', 'test-plan.md', 'changelog.md', '.state.yaml'];
const VALID_PHASES = ['requirements', 'design', 'task', 'implement', 'testing', 'delivery'];
const VALID_STATUSES = ['active', 'paused', 'blocked'];
const COMPLETION_PHASES = ['testing', 'delivery'];
const HOSTILE_QUESTIONS = [
  'Q1  What did I miss? What did I overlook? (boundary cases, error paths, empty/null inputs, state transitions, concurrency)',
  'Q2  Which of my assumptions could be wrong? Would a stricter reviewer reject them first?',
  'Q3  Which acceptance criterion or constraint from the spec did I NOT re-verify?',
  'Q4  Which callers / dependents / consumers of this change went untested?',
  'Q5  Did I patch a symptom instead of the root cause? Is the root-fix direction tracked as the end state (AGENTS.md B2/B3)?',
  'Q6  Which of my tests could pass for the wrong reason?',
  'Q7  Which state transition in .state.yaml is unhandled (phase/status/review_history)?',
  'Q8  What did I leave undocumented or unexplained in changelog.md?',
  'Q9  Is the diff minimal, or did I drag in unrelated changes for convenience?',
  'Q10 Did I run the machine gates (check.ts + lint + tests) and confirm they are green?',
];

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const prepareMode = args.includes('--prepare');
const verifyMode = args.includes('--verify');
const taskArg = args.find(arg => !arg.startsWith('--'));

function usage(): never {
  console.error('Usage: node .harness/scripts/self-review.ts <TASK_ID> --prepare');
  console.error('   or: node .harness/scripts/self-review.ts [<TASK_ID>] [--verify] [--json]');
  process.exit(1);
}
function taskPath(taskId: string, file: string): string {
  return path.join(WIP, taskId, file);
}
function listTaskDirs(): string[] {
  if (taskArg) {
    if (!/^[A-Za-z0-9._-]+$/.test(taskArg)) {
      console.error(`Invalid task id: ${taskArg}`);
      process.exit(1);
    }
    return fs.existsSync(path.join(WIP, taskArg)) ? [taskArg] : [];
  }
  if (!fs.existsSync(WIP)) return [];
  try {
    return fs.readdirSync(WIP, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => fs.existsSync(path.join(WIP, name, '.state.yaml')));
  } catch {
    return [];
  }
}
function loadState(taskId: string): TaskState | null {
  const statePath = taskPath(taskId, '.state.yaml');
  if (!fs.existsSync(statePath)) return null;
  try {
    const value = parseYaml(fs.readFileSync(statePath, 'utf8')) as unknown;
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as TaskState : null;
  } catch {
    return null;
  }
}
function loadReview(taskId: string): { record: SelfReviewRecord | null; error: string | null } {
  const reviewPath = taskPath(taskId, 'self-review.json');
  if (!fs.existsSync(reviewPath)) return { record: null, error: 'self-review.json is missing' };
  try {
    const value = JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as unknown;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { record: null, error: 'self-review.json root must be an object' };
    }
    return { record: value as SelfReviewRecord, error: null };
  } catch {
    return { record: null, error: 'self-review.json is invalid JSON' };
  }
}
function currentSnapshot(taskId: string): RepositorySnapshot {
  const taskDir = path.join(WIP, taskId);
  return repositorySnapshot(ROOT, evidenceExclusions(ROOT, taskDir));
}

function prepareSelfReview(taskId: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(taskId)) {
    console.error(`Invalid task id: ${taskId}`);
    process.exit(1);
  }
  const taskDir = path.join(WIP, taskId);
  const statePath = path.join(taskDir, '.state.yaml');
  const state = loadState(taskId);
  if (!state) {
    console.error(`Self-review prepare FAIL: task state missing or unreadable for ${taskId}`);
    process.exit(1);
  }
  const phase = String(state.phase ?? '');
  const status = String(state.status ?? '');
  if (!VALID_PHASES.includes(phase)) {
    console.error(`Self-review prepare FAIL: invalid task phase "${phase}"`);
    process.exit(1);
  }
  if (status !== 'active') {
    console.error(`Self-review prepare FAIL: task must be active (current: ${status || 'unset'})`);
    process.exit(1);
  }
  const targetPhase = phase === 'delivery' ? 'delivery' : 'testing';
  const transitioned = phase !== targetPhase;
  if (transitioned) {
    state.phase = targetPhase;
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(statePath, stringifyYaml(state));
  }

  const snapshot = currentSnapshot(taskId);
  const artifactSources = REQUIRED_FILES
    .filter(file => file !== '.state.yaml')
    .map(file => {
      const source = path.relative(ROOT, path.join(taskDir, file)).replaceAll('\\', '/');
      return `- ${source}${fs.existsSync(path.join(taskDir, file)) ? '' : ' (missing)'}`;
    })
    .join('\n');
  const questionList = HOSTILE_QUESTIONS.map(question => `- ${question}`).join('\n');
  const packet = `# Builder Self-Review Packet — ${taskId}\n\nRepository snapshot:\n- commit: ${snapshot.commit_sha}\n- worktree: ${snapshot.worktree_sha256}\n\nAnswer every hostile question after canonical machine Evidence has completed. Record the result in self-review.json with version=1.0, this task_id, this exact repository snapshot, run_at, gaps_found, root_fix_tracked, notes, and answers Q1-Q10. Then run self-review.ts ${taskId} --verify.\n\n## Hostile Questions\n\n${questionList}\n\n## Artifact sources\n\nRead these source files directly; their bodies are not duplicated in this packet:\n\n${artifactSources}\n`;
  const packetPath = path.join(taskDir, 'self-review-packet.md');
  fs.writeFileSync(packetPath, packet);
  const action = transitioned ? `transitioned ${taskId} to phase ${targetPhase}` : `kept ${taskId} in phase ${targetPhase}`;
  console.log(`Prepared ${path.relative(ROOT, packetPath).replaceAll('\\', '/')} and ${action}.`);
}

function reviewTask(taskId: string): ReviewReport {
  const taskDir = path.join(WIP, taskId);
  const checks: CheckResult[] = [];
  let misses = 0;
  let warnings = 0;
  const push = (level: 'OK' | 'WARN' | 'MISS', label: string, detail: string): void => {
    if (level === 'MISS') misses++;
    if (level === 'WARN') warnings++;
    checks.push({ level, label, detail });
  };

  for (const file of REQUIRED_FILES) {
    const ok = fs.existsSync(path.join(taskDir, file));
    push(ok ? 'OK' : 'MISS', `artifact:${file}`, ok ? 'present' : 'missing');
  }
  const state = loadState(taskId);
  if (!state) {
    push('MISS', 'state:.state.yaml', 'unreadable or missing');
  } else {
    const phase = String(state.phase ?? '');
    const status = String(state.status ?? '');
    push(VALID_PHASES.includes(phase) ? 'OK' : 'MISS', 'state:phase', VALID_PHASES.includes(phase) ? phase : `invalid phase "${phase}"`);
    push(VALID_STATUSES.includes(status) ? 'OK' : 'MISS', 'state:status', VALID_STATUSES.includes(status) ? status : `invalid status "${status}"`);
    push(COMPLETION_PHASES.includes(phase) ? 'OK' : 'MISS', 'state:completion_phase',
      COMPLETION_PHASES.includes(phase)
        ? `self-review is allowed in ${phase}`
        : `self-review is only allowed in ${COMPLETION_PHASES.join(' or ')} (current: ${phase || 'unset'})`);
    push(status === 'active' ? 'OK' : 'MISS', 'state:active_status',
      status === 'active' ? 'active' : `task must be active during self-review (current: ${status || 'unset'})`);
    const rounds = Array.isArray(state.review_history) ? state.review_history.length : 0;
    push(Array.isArray(state.review_history) ? 'OK' : 'MISS', 'state:review_history',
      Array.isArray(state.review_history) ? `${rounds} round(s) recorded` : 'review_history must be an array');
  }

  const loaded = loadReview(taskId);
  const record = loaded.record;
  push(record ? 'OK' : 'MISS', 'artifact:self-review.json', record ? 'record present' : String(loaded.error));
  if (record) {
    push(record.version === '1.0' ? 'OK' : 'MISS', 'self_review:version', record.version === '1.0' ? '1.0' : 'version must be 1.0');
    push(record.task_id === taskId ? 'OK' : 'MISS', 'self_review:task_id', record.task_id === taskId ? taskId : 'task_id mismatch');
    const repository = record.repository;
    const snapshotValid = Boolean(
      repository
      && typeof repository.commit_sha === 'string'
      && /^[0-9a-f]{40}$/.test(repository.commit_sha)
      && typeof repository.worktree_sha256 === 'string'
      && /^[0-9a-f]{64}$/.test(repository.worktree_sha256)
    );
    push(snapshotValid ? 'OK' : 'MISS', 'self_review:repository', snapshotValid ? 'snapshot recorded' : 'valid repository snapshot is required');
    if (snapshotValid) {
      const current = currentSnapshot(taskId);
      const recorded = repository as RepositorySnapshot;
      const fresh = sameSnapshot(recorded, current);
      push(fresh ? 'OK' : 'MISS', 'self_review:freshness',
        fresh ? 'fresh for current repository snapshot' : 'self-review is stale for the current repository snapshot');
    }
    const runAt = typeof record.run_at === 'string' ? record.run_at.trim() : '';
    const rootFix = typeof record.root_fix_tracked === 'string' ? record.root_fix_tracked.trim() : '';
    const notes = typeof record.notes === 'string' ? record.notes.trim() : '';
    const runAtValid = runAt.length > 0 && !Number.isNaN(Date.parse(runAt));
    push(runAtValid ? 'OK' : 'MISS', 'self_review:run_at', runAtValid ? 'recorded' : 'valid run timestamp is required');
    const gapsValid = Array.isArray(record.gaps_found)
      && record.gaps_found.every(gap => typeof gap === 'string' && gap.trim().length > 0);
    push(gapsValid ? 'OK' : 'MISS', 'self_review:gaps_found',
      gapsValid ? `${(record.gaps_found as string[]).length} gap(s) recorded` : 'must be an array of non-empty strings');
    push(rootFix.length > 0 ? 'OK' : 'MISS', 'self_review:root_fix_tracked', rootFix.length > 0 ? 'recorded' : 'missing root-fix direction');
    push(notes.length > 0 ? 'OK' : 'MISS', 'self_review:notes', notes.length > 0 ? 'recorded' : 'missing review notes');
    const answerMap = record.answers !== null && typeof record.answers === 'object' && !Array.isArray(record.answers)
      ? record.answers as Record<string, unknown>
      : null;
    push(answerMap ? 'OK' : 'MISS', 'self_review:answers', answerMap ? 'answer map present' : 'missing answers to hostile questions');
    if (answerMap) {
      for (let index = 1; index <= HOSTILE_QUESTIONS.length; index++) {
        const answer = answerMap[`Q${index}`];
        const answerText = typeof answer === 'string' ? answer.trim() : '';
        push(answerText.length > 0 ? 'OK' : 'MISS', `self_review:answers.Q${index}`,
          answerText.length > 0 ? 'answered' : 'missing answer');
      }
    }
  }

  const specPath = path.join(taskDir, 'spec.md');
  if (fs.existsSync(specPath)) {
    const hasAcceptanceCriteria = /\[[ xX]\]/g.test(fs.readFileSync(specPath, 'utf8'));
    push(hasAcceptanceCriteria ? 'OK' : 'WARN', 'spec:acceptance_criteria', hasAcceptanceCriteria ? 'checklist found' : 'no "[ ]" acceptance-criteria checklist');
  }
  const tasksPath = path.join(taskDir, 'tasks.md');
  if (fs.existsSync(tasksPath)) {
    const hasTestItems = /\[[ xX]\]/g.test(fs.readFileSync(tasksPath, 'utf8'));
    push(hasTestItems ? 'OK' : 'WARN', 'tasks:test_items', hasTestItems ? 'checklist found' : 'no "[ ]" task/test items');
  }
  const changelogPath = path.join(taskDir, 'changelog.md');
  if (fs.existsSync(changelogPath)) {
    const lineCount = fs.readFileSync(changelogPath, 'utf8').trim().split('\n')
      .filter(line => line.trim().length > 0 && line.startsWith('-')).length;
    push(lineCount > 0 ? 'OK' : 'WARN', 'changelog:entries', lineCount > 0 ? `${lineCount} entry/entries` : 'no "- " entries');
  }
  const agentsOk = fs.existsSync(README_LINK);
  push(agentsOk ? 'OK' : 'MISS', 'contract:agents.md', agentsOk ? 'present in ACLH Engine' : 'AGENTS.md missing from ACLH Engine');

  const phase = state ? String(state.phase ?? 'unknown') : 'unknown';
  const status = state ? String(state.status ?? 'unknown') : 'unknown';
  const result = misses > 0 ? 'FAIL' : (warnings > 0 ? 'WARNINGS' : 'PASS');
  return {
    task: taskId,
    state: { phase, status, has_self_review: Boolean(record && typeof record.run_at === 'string' && record.run_at.trim()) },
    checks,
    questions: [...HOSTILE_QUESTIONS],
    misses,
    warnings,
    result,
  };
}

if (prepareMode && verifyMode) usage();
if (prepareMode) {
  if (!taskArg || jsonOut || args.length !== 2) usage();
  prepareSelfReview(taskArg);
  process.exit(0);
}
if (args.some(arg => arg.startsWith('--') && !['--verify', '--json'].includes(arg))) usage();

const reports = listTaskDirs().map(reviewTask);
let overallMisses = 0;
let overallWarnings = 0;
if (jsonOut) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  for (const report of reports) {
    const icon = report.result === 'FAIL' ? '❌' : (report.result === 'WARNINGS' ? '⚠️' : '✅');
    console.log(`\n${icon} [${report.result}] Adversarial Self-Review: ${report.task}`);
    console.log(`    State: phase=${report.state.phase}, status=${report.state.status}, self_review_recorded=${report.state.has_self_review}`);
    console.log('    Artifacts & checks:');
    for (const check of report.checks) {
      const mark = check.level === 'MISS' ? '❌' : (check.level === 'WARN' ? '⚠️' : '✅');
      console.log(`      ${mark} [${check.label}] ${check.detail}`);
    }
    console.log('    Hostile questions (answer each before submitting):');
    for (const question of report.questions) console.log(`      ${question}`);
    overallMisses += report.misses;
    overallWarnings += report.warnings;
    if (report.result === 'FAIL' || report.result === 'WARNINGS') {
      console.log(`    → Fix the ${report.result === 'FAIL' ? 'MISS items' : 'WARN items'} or record them as tracked gaps, then re-run.`);
    }
  }
  if (reports.length === 0) {
    console.log('\nNo tasks found. Usage: node .harness/scripts/self-review.ts [<TASK_ID>] [--verify] [--json]');
  } else {
    console.log(`\n=== Summary: ${reports.length} task(s), ${overallMisses} MISS, ${overallWarnings} WARN ===`);
  }
}
process.exit(overallMisses > 0 || overallWarnings > 0 ? 1 : 0);
