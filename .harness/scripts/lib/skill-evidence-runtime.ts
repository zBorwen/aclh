import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { ALL_GATES, type GateName } from './evidence-runtime.ts';
import type { SkillContract } from './skill-runtime.ts';

export interface SkillEvidencePolicy {
  version: '1.0';
  verificationSkills: Map<string, GateName[]>;
}

const ROOT_KEYS = new Set(['version', 'verification_skills']);
const POLICY_KEYS = new Set(['required_gates']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(record).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${label} contains unknown field(s): ${unknown.join(', ')}`);
}
function gateArray(value: unknown, label: string): GateName[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== 'string' || !ALL_GATES.includes(item as GateName))) {
    throw new Error(`${label} must be a non-empty array of canonical gates: ${ALL_GATES.join(', ')}`);
  }
  const gates = value as GateName[];
  const duplicates = gates.filter((gate, index) => gates.indexOf(gate) !== index);
  if (duplicates.length > 0) throw new Error(`${label} contains duplicate gate(s): ${[...new Set(duplicates)].join(', ')}`);
  return gates;
}

export function loadSkillEvidencePolicy(policyPath: string): SkillEvidencePolicy {
  if (!fs.existsSync(policyPath)) throw new Error(`Skill Evidence policy not found: ${policyPath}`);
  let parsed: unknown;
  try { parsed = parseYaml(fs.readFileSync(policyPath, 'utf8')); }
  catch (error) { throw new Error(`Skill Evidence policy invalid YAML: ${(error as Error).message}`); }
  if (!isRecord(parsed)) throw new Error('Skill Evidence policy root must be an object');
  rejectUnknownKeys(parsed, ROOT_KEYS, 'Skill Evidence policy root');
  if (parsed.version !== '1.0') throw new Error('Skill Evidence policy version must be "1.0"');
  if (!isRecord(parsed.verification_skills)) throw new Error('Skill Evidence policy verification_skills must be an object');

  const verificationSkills = new Map<string, GateName[]>();
  for (const [skillId, raw] of Object.entries(parsed.verification_skills)) {
    if (!/^[a-z][a-z0-9-]*$/.test(skillId)) throw new Error(`Skill Evidence policy skill id must be kebab-case: ${skillId}`);
    if (!isRecord(raw)) throw new Error(`Skill Evidence policy ${skillId} must be an object`);
    rejectUnknownKeys(raw, POLICY_KEYS, `Skill Evidence policy ${skillId}`);
    verificationSkills.set(skillId, gateArray(raw.required_gates, `Skill Evidence policy ${skillId}.required_gates`));
  }
  return { version: '1.0', verificationSkills };
}

export function validateSkillEvidenceCoverage(catalog: Map<string, SkillContract>, policy: SkillEvidencePolicy): void {
  for (const skill of catalog.values()) {
    const mapped = policy.verificationSkills.has(skill.skill.id);
    if (skill.skill.kind === 'verification' && !mapped) throw new Error(`verification Skill has no Evidence policy mapping: ${skill.skill.id}`);
    if (skill.skill.kind !== 'verification' && mapped) throw new Error(`understanding Skill must not have an Evidence policy mapping: ${skill.skill.id}`);
  }
  for (const skillId of policy.verificationSkills.keys()) {
    if (!catalog.has(skillId)) throw new Error(`Skill Evidence policy contains orphan Skill: ${skillId}`);
  }
}

export function requiredSkillEvidenceGates(
  resolved: string[],
  catalog: Map<string, SkillContract>,
  policy: SkillEvidencePolicy,
): { bySkill: Map<string, GateName[]>; gates: GateName[] } {
  const bySkill = new Map<string, GateName[]>();
  const gates = new Set<GateName>();
  for (const skillId of resolved) {
    const skill = catalog.get(skillId);
    if (!skill) throw new Error(`resolved skill missing from catalog: ${skillId}`);
    if (skill.skill.kind !== 'verification') continue;
    const mapped = policy.verificationSkills.get(skillId);
    if (!mapped) throw new Error(`verification Skill has no Evidence policy mapping: ${skillId}`);
    bySkill.set(skillId, mapped);
    for (const gate of mapped) gates.add(gate);
  }
  return { bySkill, gates: ALL_GATES.filter(gate => gates.has(gate)) };
}
