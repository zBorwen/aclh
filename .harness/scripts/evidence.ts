#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface EvidenceEntry {
  gate: GateName;
  command: string;
  started_at: string;
  finished_at: string;
  exit_code: number;
  result: 'PASS' | 'FAIL';
}

interface EvidenceFile {
  version: '1.0';
  task_id: string;
  updated_at: string | null;
  gates: Partial<Record<GateName, EvidenceEntry>>;
}

type GateName = 'check' | 'typecheck' | 'test';

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

function loadEvidence(taskId: string, evidencePath: string): EvidenceFile {
  if (!fs.existsSync(evidencePath)) {
    return { version: '1.0', task_id: taskId, updated_at: null, gates: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as EvidenceFile;
    if (parsed.task_id !== taskId || parsed.version !== '1.0' || !parsed.gates || typeof parsed.gates !== 'object') {
      throw new Error('invalid evidence schema');
    }
    return parsed;
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
if (!fs.existsSync(taskDir) || !fs.existsSync(path.join(taskDir, '.state.yaml'))) {
  console.error(`Task not found or not initialized: ${taskId}`);
  process.exit(1);
}

const evidence = loadEvidence(taskId, evidencePath);

if (args.includes('--verify')) {
  let failed = false;
  for (const gate of REQUIRED_GATES) {
    const entry = evidence.gates[gate];
    const valid = Boolean(
      entry &&
      entry.gate === gate &&
      entry.command === GATES[gate] &&
      entry.exit_code === 0 &&
      entry.result === 'PASS' &&
      typeof entry.started_at === 'string' &&
      typeof entry.finished_at === 'string',
    );

    if (valid) {
      console.log(`[Evidence] ${taskId} ${gate}: PASS evidence present`);
    } else {
      failed = true;
      console.error(`[Evidence] ${taskId} ${gate}: missing or failing evidence`);
    }
  }
  process.exit(failed ? 1 : 0);
}

const gateIndex = args.indexOf('--gate');
const gateArg = gateIndex >= 0 ? args[gateIndex + 1] : undefined;
if (!gateArg || !(gateArg in GATES)) usage();
const gate = gateArg as GateName;

const command = GATES[gate];
const startedAt = new Date().toISOString();
const result = spawnSync(command, {
  cwd: ROOT,
  shell: true,
  stdio: 'inherit',
});
const finishedAt = new Date().toISOString();
const exitCode = typeof result.status === 'number' ? result.status : 1;

const entry: EvidenceEntry = {
  gate,
  command,
  started_at: startedAt,
  finished_at: finishedAt,
  exit_code: exitCode,
  result: exitCode === 0 ? 'PASS' : 'FAIL',
};

evidence.gates[gate] = entry;
evidence.updated_at = finishedAt;
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

console.log(`[Evidence] ${taskId} ${gate}: ${entry.result} (exit ${exitCode})`);
process.exit(exitCode);
