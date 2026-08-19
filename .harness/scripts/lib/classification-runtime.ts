import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';

export type ProblemPrimary = 'feature' | 'bug' | 'refactor' | 'migration' | 'integration';
export type ClassificationConfidence = 'high' | 'medium' | 'low';
export type ClassificationSource = 'codex' | 'human' | 'human-override';

export interface ClassificationArtifact {
  version: '1.0';
  task_id: string;
  classification: {
    primary: ProblemPrimary;
    traits: string[];
    confidence: ClassificationConfidence;
    rationale: string[];
    ambiguities: string[];
    source: ClassificationSource;
  };
}

export const PRIMARY_TYPES = new Set<ProblemPrimary>(['feature', 'bug', 'refactor', 'migration', 'integration']);
export const TRAITS = new Set([
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
export const CONFIDENCE = new Set<ClassificationConfidence>(['high', 'medium', 'low']);
export const SOURCES = new Set<ClassificationSource>(['codex', 'human', 'human-override']);
const ROOT_KEYS = new Set(['version', 'task_id', 'classification']);
const CLASSIFICATION_KEYS = new Set(['primary', 'traits', 'confidence', 'rationale', 'ambiguities', 'source']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, field: string): void {
  const unknown = Object.keys(record).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${field} contains unknown field(s): ${unknown.join(', ')}`);
}
function stringArray(value: unknown, field: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  if (!allowEmpty && value.length === 0) throw new Error(`${field} must not be empty`);
  return value as string[];
}

export function validateClassificationDocument(value: unknown, taskId: string): ClassificationArtifact {
  if (!isRecord(value)) throw new Error('root must be an object');
  rejectUnknownKeys(value, ROOT_KEYS, 'root');
  if (value.version !== '1.0') throw new Error('version must be "1.0"');
  if (value.task_id !== taskId) throw new Error(`task_id must match ${taskId}`);
  if (!isRecord(value.classification)) throw new Error('classification must be an object');
  rejectUnknownKeys(value.classification, CLASSIFICATION_KEYS, 'classification');

  const classification = value.classification;
  if (typeof classification.primary !== 'string' || !PRIMARY_TYPES.has(classification.primary as ProblemPrimary)) {
    throw new Error(`primary must be one of: ${[...PRIMARY_TYPES].join(', ')}`);
  }
  const traits = stringArray(classification.traits, 'traits', true);
  const duplicateTraits = traits.filter((trait, index) => traits.indexOf(trait) !== index);
  if (duplicateTraits.length > 0) throw new Error(`traits must be unique: ${[...new Set(duplicateTraits)].join(', ')}`);
  const unknownTraits = traits.filter(trait => !TRAITS.has(trait));
  if (unknownTraits.length > 0) throw new Error(`unknown trait(s): ${unknownTraits.join(', ')}`);
  if (typeof classification.confidence !== 'string' || !CONFIDENCE.has(classification.confidence as ClassificationConfidence)) {
    throw new Error(`confidence must be one of: ${[...CONFIDENCE].join(', ')}`);
  }
  const rationale = stringArray(classification.rationale, 'rationale', false);
  const ambiguities = stringArray(classification.ambiguities, 'ambiguities', true);
  if (typeof classification.source !== 'string' || !SOURCES.has(classification.source as ClassificationSource)) {
    throw new Error(`source must be one of: ${[...SOURCES].join(', ')}`);
  }

  return {
    version: '1.0',
    task_id: taskId,
    classification: {
      primary: classification.primary as ProblemPrimary,
      traits,
      confidence: classification.confidence as ClassificationConfidence,
      rationale,
      ambiguities,
      source: classification.source as ClassificationSource,
    },
  };
}

export function loadClassification(classificationPath: string, taskId: string): ClassificationArtifact {
  if (!fs.existsSync(classificationPath)) throw new Error(`classification.yaml missing for ${taskId}`);
  let parsed: unknown;
  try { parsed = parseYaml(fs.readFileSync(classificationPath, 'utf8')); }
  catch (error) { throw new Error(`classification.yaml is invalid YAML: ${(error as Error).message}`); }
  return validateClassificationDocument(parsed, taskId);
}
