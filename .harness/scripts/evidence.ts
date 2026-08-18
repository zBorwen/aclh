#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type GateName = 'check' | 'typecheck' | 'test';

interface RepositorySnapshot {
  commit_sha: string;
  worktree_sha256: string;
}

interface EvidenceEntry {
  gate: GateName;
  command: string;
  started_at: string;
  finished_at: string;
  exit_code: number;
  result: 'PASS' | 'FAIL';
  repository: RepositorySnapshot;
  repository_unchanged: boolean;
}

interface EvidenceFile {
  version: '1.1';
  task_id: string;
  updated_at: string | null;
  gates: Partial<Record<GateName, EvidenceEntry>>;
}

const GATES: Record<GateName, string> = {
  check: 'npm run check',
  typecheck: 'npm run typecheck',
  test: 'npm test',
};
const REQUIRED_GATES: GateName[] = ['check', 'typecheck', 'test'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const WIP = path.join(ROOT, 'docs/wip');

function usage(): never {
  console.error('Usage: node .harness/scripts/evidence.ts <TASK_ID> --gate <check|typecheck|test>');
  console.error('   or: node .harness/scripts/evidence.ts <TASK_ID> --verify');
  process.exit(1);
}

function runGitText(args: string[]): string {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function repositorySnapshot(evidenceRelativePath: string): RepositorySnapshot {
  const commitSha = runGitText(['rev-parse', 'HEAD']).trim();
  const hasher = createHash('sha256');
  const excludePathspec = `:(exclude)${evidenceRelativePath}`;

  const diff = spawnSync('git', ['diff', '--binary', 'HEAD', '--', '.', excludePathspec], {
    cwd: ROOT,
    encoding: null,
  });
  if (diff.status !== 0) {
    throw new Error(diff.stderr?.toString().trim() || 'git diff failed');
  }
  hasher.update(Buffer.from('tracked\0'));
  hasher.update(diff.stdout ?? Buffer.alloc(0));

  const untrackedRaw = runGitText(['ls-files', '--others', '--exclude-standard', '-z']);
  const untracked = untrackedRaw
    .split('\0')
    .filter(Boolean)
    .map(normalizeRepoPath)
    .filter(file => file !== evidenceRelativePath)
    .sort();

  for (const file of untracked) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) continue;
    hasher.update(Buffer.from(`untracked\0${file}\0`));
    hasher.update(fs.readFileSync(fullPath));
  }

  return {
    commit_sha: commitSha,
    worktree_sha256: hasher.digest('hex'),
  };
}

function sameSnapshot(left: RepositorySnapshot, right: RepositorySnapshot): boolean {
  return left.commit_sha === right.commit_sha && left.worktree_sha256 === right.worktree_sha256;
}

function loadEvidence(taskId: string, evidencePath: string): EvidenceFile {
  if (!fs.existsSync(evidencePath)) {
    return { version: '1.1', task_id: taskId, updated_at: null, gates: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as {
      version?: unknown;
      task_id?: unknown;
      updated_at?: unknown;
      gates?: unknown;
    };

    if (parsed.task_id !== taskId || !parsed.gates || typeof parsed.gates !== 'object') {
      throw new Error('invalid evidence schema');
    }

    if (parsed.version === '1.0') {
      console.error(`[Evidence] ${taskId}: v1.0 evidence is stale by definition; recapture all gates for v1.1`);
      return { version: '1.1', task_id: taskId, updated_at: null, gates: {} };
    }

    if (parsed.version !== '1.1') {
      throw new Error(`unsupported evidence version: ${String(parsed.version)}`);
    }

    return parsed as EvidenceFile;
  } catch (error) {
    console.error(`Invalid evidence file for ${taskId}: ${(error as Error).message}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const taskId = args[0];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) usage();

const taskDir = path.join(WIP, taskId);
const evidencePath = path.join(taskDir, 'evidence.json');
const evidenceRelativePath = normalizeRepoPath(path.relative(ROOT, evidencePath));
if (!fs.existsSync(taskDir) || !fs.existsSync(path.join(taskDir, '.state.yaml'))) {
  console.error(`Task not found or not initialized: ${taskId}`);
  process.exit(1);
}

const evidence = loadEvidence(taskId, evidencePath);

if (args.includes('--verify')) {
  let failed = false;
  let current: RepositorySnapshot;
  try {
    current = repositorySnapshot(evidenceRelativePath);
  } catch (error) {
    console.error(`[Evidence] Cannot fingerprint repository: ${(error as Error).message}`);
    process.exit(1);
  }

  for (const gate of REQUIRED_GATES) {
    const entry = evidence.gates[gate];
    const structurallyValid = Boolean(
      entry &&
      entry.gate === gate &&
      entry.command === GATES[gate] &&
      entry.exit_code === 0 &&
      entry.result === 'PASS' &&
      entry.repository_unchanged === true &&
      typeof entry.started_at === 'string' &&
      typeof entry.finished_at === 'string' &&
      entry.repository &&
      typeof entry.repository.commit_sha === 'string' &&
      typeof entry.repository.worktree_sha256 === 'string',
    );

    if (!structurallyValid || !entry) {
      failed = true;
      console.error(`[Evidence] ${taskId} ${gate}: missing or failing evidence`);
      continue;
    }

    if (!sameSnapshot(entry.repository, current)) {
      failed = true;
      console.error(`[Evidence] ${taskId} ${gate}: stale evidence; repository changed after gate execution`);
      continue;
    }

    console.log(`[Evidence] ${taskId} ${gate}: fresh PASS evidence present @ ${current.commit_sha.slice(0, 12)}`);
  }
  process.exit(failed ? 1 : 0);
}

const gateIndex = args.indexOf('--gate');
const gateArg = gateIndex >= 0 ? args[gateIndex + 1] : undefined;
if (!gateArg || !(gateArg in GATES)) usage();
const gate = gateArg as GateName;

let before: RepositorySnapshot;
try {
  before = repositorySnapshot(evidenceRelativePath);
} catch (error) {
  console.error(`[Evidence] Cannot fingerprint repository: ${(error as Error).message}`);
  process.exit(1);
}

const command = GATES[gate];
const startedAt = new Date().toISOString();
const result = spawnSync(command, {
  cwd: ROOT,
  shell: true,
  stdio: 'inherit',
});
const finishedAt = new Date().toISOString();
const exitCode = typeof result.status === 'number' ? result.status : 1;

let after: RepositorySnapshot;
try {
  after = repositorySnapshot(evidenceRelativePath);
} catch (error) {
  console.error(`[Evidence] Cannot fingerprint repository after gate: ${(error as Error).message}`);
  process.exit(1);
}

const repositoryUnchanged = sameSnapshot(before, after);
const passed = exitCode === 0 && repositoryUnchanged;
const entry: EvidenceEntry = {
  gate,
  command,
  started_at: startedAt,
  finished_at: finishedAt,
  exit_code: exitCode,
  result: passed ? 'PASS' : 'FAIL',
  repository: before,
  repository_unchanged: repositoryUnchanged,
};

evidence.gates[gate] = entry;
evidence.updated_at = finishedAt;
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (!repositoryUnchanged) {
  console.error(`[Evidence] ${taskId} ${gate}: FAIL because the gate mutated the repository state`);
}
console.log(`[Evidence] ${taskId} ${gate}: ${entry.result} (exit ${exitCode}) @ ${before.commit_sha.slice(0, 12)}`);
process.exit(passed ? 0 : 1);
