#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

// ============================================================================
// ACLH Adversarial Self-Review (TypeScript, runs natively on Node >= 22)
//
// Task-completion hook: verifies task artifacts and forces a hostile review
// of the finished work before it is submitted for human review.
//
// Usage:
//   node .harness/scripts/self-review.ts                # review all active tasks
//   node .harness/scripts/self-review.ts <TASK_ID>      # review one task
//   node .harness/scripts/self-review.ts <TASK_ID> --json
//
// Exit codes: 0 = pass (no MISS), 1 = at least one MISS (artifact/state broken)
// ============================================================================

interface TaskState {
  task_id?: unknown;
  phase?: unknown;
  status?: unknown;
  review_history?: unknown;
  self_review?: unknown;
}

interface SelfReviewRecord {
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
  state: {
    phase: string;
    status: string;
    has_self_review: boolean;
  };
  checks: CheckResult[];
  questions: string[];
  misses: number;
  warnings: number;
  result: 'PASS' | 'WARNINGS' | 'FAIL';
}

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);
const ROOT: string = path.resolve(__dirname, '../../');
const WIP: string = path.join(ROOT, 'docs/wip');

const README_LINK = path.join(ROOT, 'AGENTS.md');
const REQUIRED_FILES: string[] = ['spec.md', 'tasks.md', 'test-plan.md', 'changelog.md', '.state.yaml'];
const VALID_PHASES: string[] = ['requirements', 'design', 'task', 'implement', 'testing', 'delivery'];
const VALID_STATUSES: string[] = ['active', 'paused', 'blocked'];
const COMPLETION_PHASES: string[] = ['testing', 'delivery'];

// Hostile questions: answer each deliberately before declaring the task done.
const HOSTILE_QUESTIONS: string[] = [
  'Q1  What did I miss? What did I overlook? (boundary cases, error paths, empty/null inputs, state transitions, concurrency)',
  'Q2  Which of my assumptions could be wrong? Would a stricter reviewer reject them first?',
  'Q3  Which acceptance criterion or constraint from the spec did I NOT re-verify?',
  'Q4  Which callers / dependents / consumers of this change went untested?',
  'Q5  Did I patch a symptom instead of the root cause? Is the root-fix direction tracked as the end state (AGENTS.md B2/B3)?',
  'Q6  Which of my tests could pass for the wrong reason?',
  'Q7  Which state transition in .state.yaml is unhandled (phase/status/review_history)?',
  'Q8  What did I leave undocumented or unexplained in changelog.md?',
  'Q9  Is the diff minimal, or did I drag in unrelated changes for convenience?',
  'Q10 Did I run the machine gates (check.ts + lint + tests) and confirm they are green?'
];

const args: string[] = process.argv.slice(2);
const jsonOut: boolean = args.includes('--json');
const taskArg: string | undefined = args.find(a => !a.startsWith('--'));

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
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .filter(name => fs.existsSync(path.join(WIP, name, '.state.yaml')));
  } catch {
    return [];
  }
}

function loadState(taskDir: string): TaskState | null {
  const statePath = path.join(WIP, taskDir, '.state.yaml');
  if (!fs.existsSync(statePath)) return null;
  try {
    return parseYaml(fs.readFileSync(statePath, 'utf8')) as TaskState;
  } catch {
    return null;
  }
}

function hasRecordedSelfReview(state: TaskState | null): boolean {
  if (!state || state.self_review === null || typeof state.self_review !== 'object') return false;
  const record = state.self_review as SelfReviewRecord;
  return typeof record.run_at === 'string' && record.run_at.trim().length > 0;
}

function reviewTask(taskId: string): ReviewReport {
  const taskDir = path.join(WIP, taskId);
  const checks: CheckResult[] = [];
  const questions: string[] = [];
  let misses = 0;
  let warnings = 0;

  const push = (level: 'OK' | 'WARN' | 'MISS', label: string, detail: string): void => {
    if (level === 'MISS') misses++;
    if (level === 'WARN') warnings++;
    checks.push({ level, label, detail });
  };

  // 1. Artifact presence
  for (const file of REQUIRED_FILES) {
    const ok = fs.existsSync(path.join(taskDir, file));
    push(ok ? 'OK' : 'MISS', `artifact:${file}`, ok ? 'present' : 'missing');
  }

  // 2. State machine validity
  const state = loadState(taskId);
  if (!state) {
    push('MISS', 'state:.state.yaml', 'unreadable or missing');
  } else {
    const phase = String(state.phase ?? '');
    const status = String(state.status ?? '');
    const phaseValid = VALID_PHASES.includes(phase);
    const statusValid = VALID_STATUSES.includes(status);
    push(phaseValid ? 'OK' : 'MISS', 'state:phase', phaseValid ? phase : `invalid phase "${phase}"`);
    push(statusValid ? 'OK' : 'MISS', 'state:status', statusValid ? status : `invalid status "${status}"`);

    push(COMPLETION_PHASES.includes(phase) ? 'OK' : 'MISS', 'state:completion_phase',
      COMPLETION_PHASES.includes(phase)
        ? `self-review is allowed in ${phase}`
        : `self-review is only allowed in ${COMPLETION_PHASES.join(' or ')} (current: ${phase || 'unset'})`);
    push(status === 'active' ? 'OK' : 'MISS', 'state:active_status',
      status === 'active' ? 'active' : `task must be active during self-review (current: ${status || 'unset'})`);

    const history = state.review_history;
    const rounds = Array.isArray(history) ? history.length : 0;
    push(Array.isArray(history) ? 'OK' : 'MISS', 'state:review_history',
      Array.isArray(history) ? `${rounds} round(s) recorded` : 'review_history must be an array');

    const sr = state.self_review;
    const record: SelfReviewRecord | null = sr !== null && typeof sr === 'object'
      ? sr as SelfReviewRecord
      : null;
    push(record ? 'OK' : 'MISS', 'state:self_review',
      record ? 'record present' : 'self-review record is missing');

    if (record) {
      const runAt = typeof record.run_at === 'string' ? record.run_at.trim() : '';
      const rootFix = typeof record.root_fix_tracked === 'string' ? record.root_fix_tracked.trim() : '';
      const notes = typeof record.notes === 'string' ? record.notes.trim() : '';
      push(runAt.length > 0 ? 'OK' : 'MISS', 'state:self_review.run_at',
        runAt.length > 0 ? 'recorded' : 'missing run timestamp');
      push(Array.isArray(record.gaps_found) ? 'OK' : 'MISS', 'state:self_review.gaps_found',
        Array.isArray(record.gaps_found) ? `${record.gaps_found.length} gap(s) recorded` : 'must be an array');
      push(rootFix.length > 0 ? 'OK' : 'MISS', 'state:self_review.root_fix_tracked',
        rootFix.length > 0 ? 'recorded' : 'missing root-fix direction');
      push(notes.length > 0 ? 'OK' : 'MISS', 'state:self_review.notes',
        notes.length > 0 ? 'recorded' : 'missing review notes');

      const answers = record.answers;
      const answerMap: Record<string, unknown> | null = answers !== null && typeof answers === 'object'
        ? answers as Record<string, unknown>
        : null;
      push(answerMap ? 'OK' : 'MISS', 'state:self_review.answers',
        answerMap ? 'answer map present' : 'missing answers to hostile questions');
      if (answerMap) {
        for (let i = 1; i <= HOSTILE_QUESTIONS.length; i++) {
          const answer = answerMap[`Q${i}`];
          const answerText = typeof answer === 'string' ? answer.trim() : '';
          push(answerText.length > 0 ? 'OK' : 'MISS', `state:self_review.answers.Q${i}`,
            answerText.length > 0 ? 'answered' : 'missing answer');
        }
      }
    }
  }

  // 3. Spec acceptance criteria present
  const specPath = path.join(taskDir, 'spec.md');
  if (fs.existsSync(specPath)) {
    const spec = fs.readFileSync(specPath, 'utf8');
    const hasAC = /\[[ xX]\]/g.test(spec);
    push(hasAC ? 'OK' : 'WARN', 'spec:acceptance_criteria', hasAC ? 'checklist found' : 'no "[ ]" acceptance-criteria checklist');
  }

  // 4. Test plan / tasks coverage hints
  const tasksPath = path.join(taskDir, 'tasks.md');
  if (fs.existsSync(tasksPath)) {
    const tasks = fs.readFileSync(tasksPath, 'utf8');
    const hasTestItems = /\[[ xX]\]/g.test(tasks);
    push(hasTestItems ? 'OK' : 'WARN', 'tasks:test_items', hasTestItems ? 'checklist found' : 'no "[ ]" task/test items');
  }

  // 5. Changelog activity
  const changelogPath = path.join(taskDir, 'changelog.md');
  if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    const lineCount = changelog.trim().split('\n').filter(l => l.trim().length > 0 && l.startsWith('-')).length;
    push(lineCount > 0 ? 'OK' : 'WARN', 'changelog:entries', lineCount > 0 ? `${lineCount} entry/entries` : 'no "- " entries');
  }

  // 6. AGENTS.md constraint doc reachable (sanity for the operating contract)
  const agentsOk = fs.existsSync(README_LINK);
  push(agentsOk ? 'OK' : 'MISS', 'contract:agents.md', agentsOk ? 'present' : 'AGENTS.md missing (this self-review is defined by it)');

  // Questions are always emitted; answering them is the point of the hook.
  for (const q of HOSTILE_QUESTIONS) {
    questions.push(q);
  }

  const phase = state ? String(state.phase ?? 'unknown') : 'unknown';
  const status = state ? String(state.status ?? 'unknown') : 'unknown';
  const result = misses > 0 ? 'FAIL' : (warnings > 0 ? 'WARNINGS' : 'PASS');

  return {
    task: taskId,
    state: { phase, status, has_self_review: hasRecordedSelfReview(state) },
    checks,
    questions,
    misses,
    warnings,
    result
  };
}

const reports: ReviewReport[] = listTaskDirs().map(reviewTask);
let overallMisses = 0;
let overallWarnings = 0;

if (jsonOut) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  for (const r of reports) {
    const icon = r.result === 'FAIL' ? '❌' : (r.result === 'WARNINGS' ? '⚠️' : '✅');
    console.log(`\n${icon} [${r.result}] Adversarial Self-Review: ${r.task}`);
    console.log(`    State: phase=${r.state.phase}, status=${r.state.status}, self_review_recorded=${r.state.has_self_review}`);
    console.log('    Artifacts & checks:');
    for (const c of r.checks) {
      const mark = c.level === 'MISS' ? '❌' : (c.level === 'WARN' ? '⚠️' : '✅');
      console.log(`      ${mark} [${c.label}] ${c.detail}`);
    }
    console.log('    Hostile questions (answer each before submitting):');
    for (const q of r.questions) {
      console.log(`      ${q}`);
    }
    overallMisses += r.misses;
    overallWarnings += r.warnings;
    if (r.result === 'FAIL' || r.result === 'WARNINGS') {
      console.log(`    → Fix the ${r.result === 'FAIL' ? 'MISS items' : 'WARN items'} or record them as tracked gaps, then re-run.`);
    }
  }

  if (reports.length === 0) {
    console.log(`\nNo tasks found. Usage: node .harness/scripts/self-review.ts [<TASK_ID>] [--json]`);
  } else {
    console.log(`\n=== Summary: ${reports.length} task(s), ${overallMisses} MISS, ${overallWarnings} WARN ===`);
  }
}

process.exit(overallMisses > 0 || overallWarnings > 0 ? 1 : 0);
