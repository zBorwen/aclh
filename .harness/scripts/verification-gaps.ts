#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  browserRepositorySnapshot,
  browserVerificationPath,
  browserVerificationStatus,
  loadBrowserVerification,
} from './lib/browser-verification-runtime.ts';
import {
  ALL_GATES,
  evidenceExclusions,
  loadEvidenceFile,
  repositorySnapshot,
  resolveGateCommandSpecs,
  verifyEvidenceGates,
  type GateName,
} from './lib/evidence-runtime.ts';
import { loadVerificationGapRegistry } from './lib/verification-gap-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const taskId = process.argv[2];
const mode = process.argv[3];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || (mode !== '--check' && mode !== '--verify') || process.argv.length !== 4) {
  console.error('Usage: node .harness/scripts/verification-gaps.ts <TASK_ID> --check|--verify');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const registryPath = path.join(taskDir, 'verification-gaps.yaml');
const evidencePath = path.join(taskDir, 'evidence.json');

function currentBrowserScript(): string {
  const packagePath = path.join(roots.projectRoot, 'package.json');
  if (!fs.existsSync(packagePath)) throw new Error('browser proof requires consumer package.json');
  let parsed: unknown;
  try { parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')); }
  catch { throw new Error('browser proof requires valid consumer package.json'); }
  const record = typeof parsed === 'object' && parsed !== null ? parsed as { scripts?: unknown } : {};
  const scripts = typeof record.scripts === 'object' && record.scripts !== null ? record.scripts as Record<string, unknown> : {};
  const command = scripts['test:browser'];
  if (typeof command !== 'string' || command.trim().length === 0) throw new Error('browser proof requires package.json script "test:browser"');
  return command.trim();
}

try {
  const registry = loadVerificationGapRegistry(registryPath, taskId);
  const uncovered = registry.entries.filter(entry => entry.status === 'uncovered');
  if (uncovered.length > 0) {
    for (const entry of uncovered) console.error(`Verification Gap FAIL: ${entry.id} is uncovered - ${entry.notes}`);
    process.exit(1);
  }

  const machineEntries = registry.entries.filter(entry => entry.status === 'machine-covered');
  const humanEntries = registry.entries.filter(entry => entry.status === 'human-covered');

  if (mode === '--verify' && machineEntries.length > 0) {
    const requiredGates = [...new Set(machineEntries.flatMap(entry => entry.machine_gates ?? []))] as GateName[];
    if (requiredGates.length > 0) {
      const { evidence, legacyV1 } = loadEvidenceFile(taskId, evidencePath);
      if (legacyV1) throw new Error('legacy Evidence v1.0 cannot satisfy Verification Gap coverage');
      const current = repositorySnapshot(roots.projectRoot, evidenceExclusions(roots.projectRoot, taskDir));
      const commandSpecs = resolveGateCommandSpecs(roots.runtimeRoot, roots.projectRoot);
      const expectedCommands = Object.fromEntries(ALL_GATES.map(gate => [gate, commandSpecs[gate].command])) as Record<GateName, string>;
      const statuses = verifyEvidenceGates(evidence, current, requiredGates, expectedCommands);
      for (const entry of machineEntries) {
        for (const gate of entry.machine_gates ?? []) {
          const status = statuses.get(gate);
          if (status !== 'fresh') {
            console.error(`Verification Gap FAIL: ${entry.id} requires fresh canonical ${gate} Evidence; status=${String(status)}`);
            process.exit(1);
          }
        }
      }
    }

    const requiresBrowser = machineEntries.some(entry => entry.machine_proofs?.includes('browser'));
    if (requiresBrowser) {
      const scriptCommand = currentBrowserScript();
      const record = loadBrowserVerification(browserVerificationPath(taskDir), taskId);
      const current = browserRepositorySnapshot(roots.projectRoot, taskDir);
      const status = browserVerificationStatus(record, current, scriptCommand);
      for (const entry of machineEntries.filter(item => item.machine_proofs?.includes('browser'))) {
        if (status !== 'fresh') {
          console.error(`Verification Gap FAIL: ${entry.id} requires fresh browser verification proof; status=${status}`);
          process.exit(1);
        }
      }
    }
  }

  const label = mode === '--check' ? 'CHECK' : 'PASS';
  console.log(`Verification Gaps ${label} for ${taskId}: ${machineEntries.length} machine-covered, ${humanEntries.length} human-covered, 0 uncovered.`);
} catch (error) {
  console.error(`Verification Gap FAIL: ${(error as Error).message}`);
  process.exit(1);
}
