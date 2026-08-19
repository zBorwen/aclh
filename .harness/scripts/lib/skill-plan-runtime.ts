import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';

export interface SkillPlanArtifact {
  version: '1.0';
  task_id: string;
  classification: { ref: 'classification.yaml' };
  selected: string[];
  resolved?: string[];
}

const ROOT_KEYS = new Set(['version', 'task_id', 'classification', 'selected', 'resolved']);
const CLASSIFICATION_KEYS = new Set(['ref']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(record).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${label} contains unknown field(s): ${unknown.join(', ')}`);
}
function skillArray(value: unknown, label: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item))) {
    throw new Error(`${label} must be an array of kebab-case skill ids`);
  }
  if (!allowEmpty && value.length === 0) throw new Error(`${label} must not be empty`);
  const result = value as string[];
  const duplicates = result.filter((item, index) => result.indexOf(item) !== index);
  if (duplicates.length > 0) throw new Error(`${label} contains duplicate skill(s): ${[...new Set(duplicates)].join(', ')}`);
  return result;
}

export function validateSkillPlanDocument(value: unknown, taskId: string, requireResolved: boolean): SkillPlanArtifact {
  if (!isRecord(value)) throw new Error('skill-plan root must be an object');
  rejectUnknownKeys(value, ROOT_KEYS, 'skill-plan root');
  if (value.version !== '1.0') throw new Error('skill-plan version must be "1.0"');
  if (value.task_id !== taskId) throw new Error(`skill-plan task_id must match ${taskId}`);
  if (!isRecord(value.classification)) throw new Error('skill-plan classification must be an object');
  rejectUnknownKeys(value.classification, CLASSIFICATION_KEYS, 'skill-plan classification');
  if (value.classification.ref !== 'classification.yaml') throw new Error('skill-plan classification.ref must be classification.yaml');

  const selectedRaw = skillArray(value.selected, 'skill-plan selected', false);
  const selectedCanonical = [...selectedRaw].sort();
  if (requireResolved && selectedRaw.join('\0') !== selectedCanonical.join('\0')) {
    throw new Error('skill-plan selected must be in canonical sorted order; run --resolve');
  }
  const selected = requireResolved ? selectedRaw : selectedCanonical;

  let resolved: string[] | undefined;
  if (value.resolved !== undefined) resolved = skillArray(value.resolved, 'skill-plan resolved', false);
  if (requireResolved && resolved === undefined) throw new Error('skill-plan resolved is required; run --resolve');

  return {
    version: '1.0', task_id: taskId,
    classification: { ref: 'classification.yaml' },
    selected,
    ...(resolved ? { resolved } : {}),
  };
}

export function loadSkillPlan(planPath: string, taskId: string, requireResolved: boolean): SkillPlanArtifact {
  if (!fs.existsSync(planPath)) throw new Error(`skill-plan.yaml missing for ${taskId}`);
  let parsed: unknown;
  try { parsed = parseYaml(fs.readFileSync(planPath, 'utf8')); }
  catch (error) { throw new Error(`skill-plan.yaml is invalid YAML: ${(error as Error).message}`); }
  return validateSkillPlanDocument(parsed, taskId, requireResolved);
}
