#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadClassification } from './lib/classification-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const WIP = roots.projectWipDir;

const args = process.argv.slice(2);
const taskId = args[0];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || args[1] !== '--verify' || args.length !== 2) {
  console.error('Usage: node .harness/scripts/classification.ts <TASK_ID> --verify');
  process.exit(1);
}

const taskDir = path.join(WIP, taskId);
if (!fs.existsSync(taskDir)) {
  console.error(`Classification FAIL: task not found: ${taskId}`);
  process.exit(1);
}

try {
  const artifact = loadClassification(path.join(taskDir, 'classification.yaml'), taskId);
  const classification = artifact.classification;
  console.log(`Classification PASS for ${taskId}: ${classification.primary} (${classification.confidence}, source=${classification.source})`);
} catch (error) {
  console.error(`Classification FAIL: ${(error as Error).message}`);
  process.exit(1);
}
