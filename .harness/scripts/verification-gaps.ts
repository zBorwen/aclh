#!/usr/bin/env node
import path from 'node:path';
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
    const { evidence, legacyV1 } = loadEvidenceFile(taskId, evidencePath);
    if (legacyV1) throw new Error('legacy Evidence v1.0 cannot satisfy Verification Gap coverage');
    const current = repositorySnapshot(roots.projectRoot, evidenceExclusions(roots.projectRoot, taskDir));
    const commandSpecs = resolveGateCommandSpecs(roots.runtimeRoot, roots.projectRoot);
    const expectedCommands = Object.fromEntries(ALL_GATES.map(gate => [gate, commandSpecs[gate].command])) as Record<GateName, string>;
    const required = [...new Set(machineEntries.flatMap(entry => entry.machine_gates ?? []))] as GateName[];
    const statuses = verifyEvidenceGates(evidence, current, required, expectedCommands);
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

  const label = mode === '--check' ? 'CHECK' : 'PASS';
  console.log(`Verification Gaps ${label} for ${taskId}: ${machineEntries.length} machine-covered, ${humanEntries.length} human-covered, 0 uncovered.`);
} catch (error) {
  console.error(`Verification Gap FAIL: ${(error as Error).message}`);
  process.exit(1);
}
