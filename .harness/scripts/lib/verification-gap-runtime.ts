import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { ALL_GATES, type GateName } from './evidence-runtime.ts';

export type VerificationCoverageStatus = 'machine-covered' | 'human-covered' | 'uncovered';

export interface VerificationGapEntry {
  id: string;
  dimension: string;
  description: string;
  status: VerificationCoverageStatus;
  machine_gates?: GateName[];
  human?: {
    source: 'human';
    checked_by: string;
    checked_at: string;
    procedure: string;
    result: string;
  };
  notes?: string;
}

export interface VerificationGapRegistry {
  version: '1.0';
  task_id: string;
  assessment: {
    source: 'codex' | 'human';
    summary: string;
  };
  entries: VerificationGapEntry[];
}

const ROOT_KEYS = new Set(['version', 'task_id', 'assessment', 'entries']);
const ASSESSMENT_KEYS = new Set(['source', 'summary']);
const ENTRY_KEYS = new Set(['id', 'dimension', 'description', 'status', 'machine_gates', 'human', 'notes']);
const HUMAN_KEYS = new Set(['source', 'checked_by', 'checked_at', 'procedure', 'result']);
const STATUSES = new Set<VerificationCoverageStatus>(['machine-covered', 'human-covered', 'uncovered']);
const GATE_SET = new Set<string>(ALL_GATES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(record).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${label} contains unknown field(s): ${unknown.join(', ')}`);
}
function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}
function kebab(value: unknown, label: string): string {
  const result = nonEmpty(value, label);
  if (!/^[a-z][a-z0-9-]*$/.test(result)) throw new Error(`${label} must be kebab-case`);
  return result;
}
function gateList(value: unknown, label: string): GateName[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== 'string' || !GATE_SET.has(item))) {
    throw new Error(`${label} must contain one or more canonical gates: ${ALL_GATES.join(', ')}`);
  }
  const result = value as GateName[];
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicate gates`);
  const canonical = ALL_GATES.filter(gate => result.includes(gate));
  if (canonical.join('\0') !== result.join('\0')) throw new Error(`${label} must use canonical gate order`);
  return result;
}
function validTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function validateVerificationGapRegistry(value: unknown, taskId: string): VerificationGapRegistry {
  if (!isRecord(value)) throw new Error('verification-gaps root must be an object');
  rejectUnknownKeys(value, ROOT_KEYS, 'verification-gaps root');
  if (value.version !== '1.0') throw new Error('verification-gaps version must be "1.0"');
  if (value.task_id !== taskId) throw new Error(`verification-gaps task_id must match ${taskId}`);
  if (!isRecord(value.assessment)) throw new Error('verification-gaps assessment must be an object');
  rejectUnknownKeys(value.assessment, ASSESSMENT_KEYS, 'verification-gaps assessment');
  if (value.assessment.source !== 'codex' && value.assessment.source !== 'human') {
    throw new Error('verification-gaps assessment.source must be codex or human');
  }
  const summary = nonEmpty(value.assessment.summary, 'verification-gaps assessment.summary');
  if (!Array.isArray(value.entries)) throw new Error('verification-gaps entries must be an array');

  const entries: VerificationGapEntry[] = value.entries.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`verification-gaps entries[${index}] must be an object`);
    rejectUnknownKeys(raw, ENTRY_KEYS, `verification-gaps entries[${index}]`);
    const id = kebab(raw.id, `verification-gaps entries[${index}].id`);
    const dimension = kebab(raw.dimension, `verification-gaps entries[${index}].dimension`);
    const description = nonEmpty(raw.description, `verification-gaps entries[${index}].description`);
    if (typeof raw.status !== 'string' || !STATUSES.has(raw.status as VerificationCoverageStatus)) {
      throw new Error(`verification-gaps entries[${index}].status is invalid`);
    }
    const status = raw.status as VerificationCoverageStatus;
    const notes = raw.notes === undefined ? undefined : nonEmpty(raw.notes, `verification-gaps entries[${index}].notes`);

    if (status === 'machine-covered') {
      if (raw.human !== undefined) throw new Error(`verification-gaps ${id}: machine-covered must not declare human coverage`);
      return { id, dimension, description, status, machine_gates: gateList(raw.machine_gates, `verification-gaps ${id}.machine_gates`), ...(notes ? { notes } : {}) };
    }

    if (status === 'human-covered') {
      if (raw.machine_gates !== undefined) throw new Error(`verification-gaps ${id}: human-covered must not declare machine_gates`);
      if (!isRecord(raw.human)) throw new Error(`verification-gaps ${id}: human coverage record is required`);
      rejectUnknownKeys(raw.human, HUMAN_KEYS, `verification-gaps ${id}.human`);
      if (raw.human.source !== 'human') throw new Error(`verification-gaps ${id}: human.source must be human`);
      const checkedAt = nonEmpty(raw.human.checked_at, `verification-gaps ${id}.human.checked_at`);
      if (!validTimestamp(checkedAt)) throw new Error(`verification-gaps ${id}: human.checked_at must be a timestamp`);
      return {
        id, dimension, description, status,
        human: {
          source: 'human',
          checked_by: nonEmpty(raw.human.checked_by, `verification-gaps ${id}.human.checked_by`),
          checked_at: checkedAt,
          procedure: nonEmpty(raw.human.procedure, `verification-gaps ${id}.human.procedure`),
          result: nonEmpty(raw.human.result, `verification-gaps ${id}.human.result`),
        },
        ...(notes ? { notes } : {}),
      };
    }

    if (raw.machine_gates !== undefined || raw.human !== undefined) {
      throw new Error(`verification-gaps ${id}: uncovered must not claim machine or human coverage`);
    }
    if (!notes) throw new Error(`verification-gaps ${id}: uncovered requires notes describing the gap`);
    return { id, dimension, description, status, notes };
  });

  const duplicateIds = entries.filter((entry, index) => entries.findIndex(other => other.id === entry.id) !== index).map(entry => entry.id);
  if (duplicateIds.length > 0) throw new Error(`verification-gaps contains duplicate id(s): ${[...new Set(duplicateIds)].join(', ')}`);

  return {
    version: '1.0',
    task_id: taskId,
    assessment: { source: value.assessment.source, summary },
    entries,
  };
}

export function loadVerificationGapRegistry(file: string, taskId: string): VerificationGapRegistry {
  if (!fs.existsSync(file)) throw new Error(`verification-gaps.yaml missing for ${taskId}`);
  let parsed: unknown;
  try { parsed = parseYaml(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`verification-gaps.yaml is invalid YAML: ${(error as Error).message}`); }
  return validateVerificationGapRegistry(parsed, taskId);
}
