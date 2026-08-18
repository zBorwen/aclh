#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type GateName = 'check' | 'typecheck' | 'test';

type GateResult = {
  gate: GateName;
  command: string;
  started_at: string;
  finished_at: string;
  exit_code: number;
  result: 'PASS' | 'FAIL';
};

type CiEvidence = {
  version: '1.0';
  verifier: {
    kind: 'github-actions';
    script: '.harness/scripts/ci-evidence.ts';
  };
  provenance: {
    repository: string;
    commit_sha: string;
    run_id: string;
    run_attempt: string;
    workflow: string;
    actor: string;
    server_url: string;
  };
  started_at: string;
  finished_at: string;
  result: 'PASS' | 'FAIL';
  gates: Record<GateName, GateResult>;
};

const GATES: Record<GateName, string> = {
  check: 'npm run check',
  typecheck: 'npm run typecheck',
  test: 'npm test',
};
const GATE_ORDER: GateName[] = ['check', 'typecheck', 'test'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const OUTPUT_DIR = path.join(ROOT, '.harness/artifacts');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'ci-evidence.json');

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[CI Evidence] Missing required GitHub Actions environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.error('[CI Evidence] This verifier must run inside GitHub Actions.');
  process.exit(1);
}

const provenance = {
  repository: requiredEnv('GITHUB_REPOSITORY'),
  commit_sha: requiredEnv('GITHUB_SHA'),
  run_id: requiredEnv('GITHUB_RUN_ID'),
  run_attempt: requiredEnv('GITHUB_RUN_ATTEMPT'),
  workflow: requiredEnv('GITHUB_WORKFLOW'),
  actor: requiredEnv('GITHUB_ACTOR'),
  server_url: requiredEnv('GITHUB_SERVER_URL'),
};

if (!/^[0-9a-f]{40}$/i.test(provenance.commit_sha)) {
  console.error(`[CI Evidence] Invalid GITHUB_SHA: ${provenance.commit_sha}`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const runStartedAt = new Date().toISOString();
const gates = {} as Record<GateName, GateResult>;
let failed = false;

for (const gate of GATE_ORDER) {
  const command = GATES[gate];
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit',
  });
  const finishedAt = new Date().toISOString();
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const gateResult: GateResult = {
    gate,
    command,
    started_at: startedAt,
    finished_at: finishedAt,
    exit_code: exitCode,
    result: exitCode === 0 ? 'PASS' : 'FAIL',
  };
  gates[gate] = gateResult;
  if (gateResult.result === 'FAIL') failed = true;
}

const evidence: CiEvidence = {
  version: '1.0',
  verifier: {
    kind: 'github-actions',
    script: '.harness/scripts/ci-evidence.ts',
  },
  provenance,
  started_at: runStartedAt,
  finished_at: new Date().toISOString(),
  result: failed ? 'FAIL' : 'PASS',
  gates,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`[CI Evidence] ${evidence.result}: ${OUTPUT_PATH}`);
process.exit(failed ? 1 : 0);
