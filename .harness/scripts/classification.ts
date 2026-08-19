#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const WIP = path.join(ROOT, 'docs/wip');

const PRIMARY_TYPES = new Set(['feature', 'bug', 'refactor', 'migration', 'integration']);
const TRAITS = new Set([
  'behavior-change',
  'behavior-preserving',
  'cross-module',
  'cross-system',
  'dependency-change',
  'schema-change',
  'compatibility-sensitive',
  'rollback-sensitive',
  'security-sensitive',
  'performance-sensitive',
  'ui-interaction',
  'config-change',
]);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const SOURCES = new Set(['codex', 'human', 'human-override']);
const ROOT_KEYS = new Set(['version', 'task_id', 'classification']);
const CLASSIFICATION_KEYS = new Set(['primary', 'traits', 'confidence', 'rationale', 'ambiguities', 'source']);

function fail(message: string): never {
  console.error(`Classification FAIL: ${message}`);
  process.exit(1);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringArray(value: unknown, field: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
    fail(`${field} must be an array of non-empty strings`);
  }
  if (!allowEmpty && value.length === 0) fail(`${field} must not be empty`);
  return value as string[];
}
function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, field: string): void {
  const unknown = Object.keys(record).filter(key => !allowed.has(key));
  if (unknown.length > 0) fail(`${field} contains unknown field(s): ${unknown.join(', ')}`);
}

const args = process.argv.slice(2);
const taskId = args[0];
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || args[1] !== '--verify' || args.length !== 2) {
  console.error('Usage: node .harness/scripts/classification.ts <TASK_ID> --verify');
  process.exit(1);
}

const taskDir = path.join(WIP, taskId);
const classificationPath = path.join(taskDir, 'classification.yaml');
if (!fs.existsSync(taskDir)) fail(`task not found: ${taskId}`);
if (!fs.existsSync(classificationPath)) fail(`classification.yaml missing for ${taskId}`);

let parsed: unknown;
try {
  parsed = parseYaml(fs.readFileSync(classificationPath, 'utf8'));
} catch (error) {
  fail(`classification.yaml is invalid YAML: ${(error as Error).message}`);
}
if (!isRecord(parsed)) fail('root must be an object');
rejectUnknownKeys(parsed, ROOT_KEYS, 'root');
if (parsed.version !== '1.0') fail('version must be "1.0"');
if (parsed.task_id !== taskId) fail(`task_id must match ${taskId}`);
if (!isRecord(parsed.classification)) fail('classification must be an object');
rejectUnknownKeys(parsed.classification, CLASSIFICATION_KEYS, 'classification');

const classification = parsed.classification;
if (typeof classification.primary !== 'string' || !PRIMARY_TYPES.has(classification.primary)) {
  fail(`primary must be one of: ${[...PRIMARY_TYPES].join(', ')}`);
}
const traits = stringArray(classification.traits, 'traits', true);
const duplicateTraits = traits.filter((trait, index) => traits.indexOf(trait) !== index);
if (duplicateTraits.length > 0) fail(`traits must be unique: ${[...new Set(duplicateTraits)].join(', ')}`);
const unknownTraits = traits.filter(trait => !TRAITS.has(trait));
if (unknownTraits.length > 0) fail(`unknown trait(s): ${unknownTraits.join(', ')}`);
if (typeof classification.confidence !== 'string' || !CONFIDENCE.has(classification.confidence)) {
  fail(`confidence must be one of: ${[...CONFIDENCE].join(', ')}`);
}
stringArray(classification.rationale, 'rationale', false);
stringArray(classification.ambiguities, 'ambiguities', true);
if (typeof classification.source !== 'string' || !SOURCES.has(classification.source)) {
  fail(`source must be one of: ${[...SOURCES].join(', ')}`);
}

console.log(`Classification PASS for ${taskId}: ${classification.primary} (${classification.confidence}, source=${classification.source})`);
