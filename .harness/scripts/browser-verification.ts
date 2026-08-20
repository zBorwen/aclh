#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  browserRepositorySnapshot,
  browserVerificationPath,
  browserVerificationStatus,
  loadBrowserVerification,
  type BrowserVerificationRecord,
} from './lib/browser-verification-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';
import { sameSnapshot } from './lib/evidence-runtime.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const taskId = process.argv[2];
const mode = process.argv[3];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || (mode !== '--run' && mode !== '--verify') || process.argv.length !== 4) {
  console.error('Usage: node .harness/scripts/browser-verification.ts <TASK_ID> --run|--verify');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
if (!fs.existsSync(path.join(taskDir, '.state.yaml'))) {
  console.error(`Browser Verification FAIL: task not found: ${taskId}`);
  process.exit(1);
}

function browserScript(): string {
  const packagePath = path.join(roots.projectRoot, 'package.json');
  if (!fs.existsSync(packagePath)) throw new Error('consumer package.json is missing');
  let parsed: unknown;
  try { parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')); }
  catch { throw new Error('consumer package.json is invalid JSON'); }
  const record = typeof parsed === 'object' && parsed !== null ? parsed as { scripts?: unknown } : {};
  const scripts = typeof record.scripts === 'object' && record.scripts !== null ? record.scripts as Record<string, unknown> : {};
  const command = scripts['test:browser'];
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new Error('browser verification unavailable: package.json script "test:browser" is missing');
  }
  return command.trim();
}

try {
  const scriptCommand = browserScript();
  const output = browserVerificationPath(taskDir);

  if (mode === '--verify') {
    const record = loadBrowserVerification(output, taskId);
    const current = browserRepositorySnapshot(roots.projectRoot, taskDir);
    const status = browserVerificationStatus(record, current, scriptCommand);
    if (status !== 'fresh') throw new Error(`browser verification proof is ${status}`);
    console.log(`Browser Verification PASS for ${taskId}: fresh npm run test:browser proof.`);
    process.exit(0);
  }

  const before = browserRepositorySnapshot(roots.projectRoot, taskDir);
  const startedAt = new Date().toISOString();
  const npmProgram = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmProgram, ['run', 'test:browser'], {
    cwd: roots.projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const exitCode = result.status ?? 1;
  const finishedAt = new Date().toISOString();
  const after = browserRepositorySnapshot(roots.projectRoot, taskDir);
  const unchanged = sameSnapshot(before, after);
  const passed = exitCode === 0 && unchanged;
  const record: BrowserVerificationRecord = {
    version: '1.0',
    task_id: taskId,
    provider: 'npm-script',
    npm_script: 'test:browser',
    script_command: scriptCommand,
    command: 'npm run test:browser',
    started_at: startedAt,
    finished_at: finishedAt,
    exit_code: exitCode,
    result: passed ? 'PASS' : 'FAIL',
    repository: before,
    repository_unchanged: unchanged,
  };
  fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
  if (!unchanged) console.error('Browser Verification FAIL: repository changed while browser verification was running');
  console.log(`Browser Verification ${passed ? 'PASS' : 'FAIL'} for ${taskId}: npm run test:browser.`);
  process.exit(passed ? 0 : 1);
} catch (error) {
  console.error(`Browser Verification FAIL: ${(error as Error).message}`);
  process.exit(1);
}
