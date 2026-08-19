import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export type SkillKind = 'understanding' | 'verification';
export type ContextResolver = 'changed-files' | 'project-file' | 'knowledge';

export interface SkillContract {
  skill: { id: string; version: '1.0'; kind: SkillKind };
  description: string;
  requires: {
    context: { required: string[]; optional: string[] };
    skills: string[];
  };
  produces: { artifacts: string[]; facts: string[] };
  completion: { invariants: string[] };
}

export interface ContextCapability {
  id: string;
  resolver: ContextResolver;
  source?: string;
}

const ROOT_KEYS = new Set(['skill', 'description', 'requires', 'produces', 'completion']);
const SKILL_KEYS = new Set(['id', 'version', 'kind']);
const REQUIRES_KEYS = new Set(['context', 'skills']);
const CONTEXT_KEYS = new Set(['required', 'optional']);
const PRODUCES_KEYS = new Set(['artifacts', 'facts']);
const COMPLETION_KEYS = new Set(['invariants']);
const KINDS = new Set<SkillKind>(['understanding', 'verification']);
const CONTEXT_REGISTRY_KEYS = new Set(['version', 'capabilities']);
const CAPABILITY_KEYS = new Set(['resolver', 'source']);
const CONTEXT_RESOLVERS = new Set<ContextResolver>(['changed-files', 'project-file', 'knowledge']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(record).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${label} contains unknown field(s): ${unknown.join(', ')}`);
}
function stringArray(value: unknown, label: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  if (!allowEmpty && value.length === 0) throw new Error(`${label} must not be empty`);
  const result = value as string[];
  const duplicates = result.filter((item, index) => result.indexOf(item) !== index);
  if (duplicates.length > 0) throw new Error(`${label} contains duplicate value(s): ${[...new Set(duplicates)].join(', ')}`);
  return result;
}

export function validateSkillDocument(value: unknown, sourceName: string): SkillContract {
  if (!isRecord(value)) throw new Error(`${sourceName}: root must be an object`);
  rejectUnknownKeys(value, ROOT_KEYS, `${sourceName}: root`);
  if (!isRecord(value.skill)) throw new Error(`${sourceName}: skill must be an object`);
  rejectUnknownKeys(value.skill, SKILL_KEYS, `${sourceName}: skill`);

  const id = value.skill.id;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`${sourceName}: skill.id must be kebab-case`);
  if (value.skill.version !== '1.0') throw new Error(`${sourceName}: skill.version must be "1.0"`);
  if (typeof value.skill.kind !== 'string' || !KINDS.has(value.skill.kind as SkillKind)) {
    throw new Error(`${sourceName}: skill.kind must be understanding or verification`);
  }
  if (typeof value.description !== 'string' || value.description.trim().length === 0) throw new Error(`${sourceName}: description must not be empty`);

  if (!isRecord(value.requires)) throw new Error(`${sourceName}: requires must be an object`);
  rejectUnknownKeys(value.requires, REQUIRES_KEYS, `${sourceName}: requires`);
  if (!isRecord(value.requires.context)) throw new Error(`${sourceName}: requires.context must be an object`);
  rejectUnknownKeys(value.requires.context, CONTEXT_KEYS, `${sourceName}: requires.context`);
  const requiredContext = stringArray(value.requires.context.required, `${sourceName}: requires.context.required`, true);
  const optionalContext = stringArray(value.requires.context.optional, `${sourceName}: requires.context.optional`, true);
  const contextOverlap = requiredContext.filter(item => optionalContext.includes(item));
  if (contextOverlap.length > 0) throw new Error(`${sourceName}: context cannot be both required and optional: ${contextOverlap.join(', ')}`);
  const requiredSkills = stringArray(value.requires.skills, `${sourceName}: requires.skills`, true);
  if (requiredSkills.includes(id)) throw new Error(`${sourceName}: skill cannot depend on itself`);

  if (!isRecord(value.produces)) throw new Error(`${sourceName}: produces must be an object`);
  rejectUnknownKeys(value.produces, PRODUCES_KEYS, `${sourceName}: produces`);
  const artifacts = stringArray(value.produces.artifacts, `${sourceName}: produces.artifacts`, true);
  const facts = stringArray(value.produces.facts, `${sourceName}: produces.facts`, true);
  if (artifacts.length === 0 && facts.length === 0) throw new Error(`${sourceName}: produces must declare at least one artifact or fact`);

  if (!isRecord(value.completion)) throw new Error(`${sourceName}: completion must be an object`);
  rejectUnknownKeys(value.completion, COMPLETION_KEYS, `${sourceName}: completion`);
  const invariants = stringArray(value.completion.invariants, `${sourceName}: completion.invariants`, false);

  return {
    skill: { id, version: '1.0', kind: value.skill.kind as SkillKind },
    description: value.description,
    requires: { context: { required: requiredContext, optional: optionalContext }, skills: requiredSkills },
    produces: { artifacts, facts },
    completion: { invariants },
  };
}

export function loadSkillCatalog(skillsDir: string): Map<string, SkillContract> {
  if (!fs.existsSync(skillsDir)) throw new Error(`skills directory not found: ${skillsDir}`);
  const files = fs.readdirSync(skillsDir).filter(file => file.endsWith('.yaml')).sort();
  const catalog = new Map<string, SkillContract>();
  for (const file of files) {
    const fullPath = path.join(skillsDir, file);
    let parsed: unknown;
    try { parsed = parseYaml(fs.readFileSync(fullPath, 'utf8')); }
    catch (error) { throw new Error(`${file}: invalid YAML: ${(error as Error).message}`); }
    const contract = validateSkillDocument(parsed, file);
    if (`${contract.skill.id}.yaml` !== file) throw new Error(`${file}: filename must match skill.id (${contract.skill.id}.yaml)`);
    if (catalog.has(contract.skill.id)) throw new Error(`duplicate skill id: ${contract.skill.id}`);
    catalog.set(contract.skill.id, contract);
  }
  for (const contract of catalog.values()) {
    for (const dependency of contract.requires.skills) {
      if (!catalog.has(dependency)) throw new Error(`${contract.skill.id}: unknown skill dependency: ${dependency}`);
    }
  }
  return catalog;
}

export function loadContextCapabilities(registryPath: string): Map<string, ContextCapability> {
  if (!fs.existsSync(registryPath)) throw new Error(`context capability registry not found: ${registryPath}`);
  let parsed: unknown;
  try { parsed = parseYaml(fs.readFileSync(registryPath, 'utf8')); }
  catch (error) { throw new Error(`context capability registry invalid YAML: ${(error as Error).message}`); }
  if (!isRecord(parsed)) throw new Error('context capability registry root must be an object');
  rejectUnknownKeys(parsed, CONTEXT_REGISTRY_KEYS, 'context capability registry root');
  if (parsed.version !== '1.0') throw new Error('context capability registry version must be "1.0"');
  if (!isRecord(parsed.capabilities)) throw new Error('context capability registry capabilities must be an object');

  const capabilities = new Map<string, ContextCapability>();
  for (const [id, raw] of Object.entries(parsed.capabilities)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`context capability id must be kebab-case: ${id}`);
    if (!isRecord(raw)) throw new Error(`context capability ${id} must be an object`);
    rejectUnknownKeys(raw, CAPABILITY_KEYS, `context capability ${id}`);
    if (typeof raw.resolver !== 'string' || !CONTEXT_RESOLVERS.has(raw.resolver as ContextResolver)) {
      throw new Error(`context capability ${id} has invalid resolver`);
    }
    const resolver = raw.resolver as ContextResolver;
    const source = raw.source;
    if (resolver === 'changed-files') {
      if (source !== undefined) throw new Error(`context capability ${id}: changed-files resolver must not declare source`);
      capabilities.set(id, { id, resolver });
      continue;
    }
    if (typeof source !== 'string' || source.trim().length === 0) {
      throw new Error(`context capability ${id}: ${resolver} resolver requires source`);
    }
    capabilities.set(id, { id, resolver, source });
  }
  return capabilities;
}

export function validateSkillContextCapabilities(
  catalog: Map<string, SkillContract>,
  capabilities: Map<string, ContextCapability>,
): void {
  for (const contract of catalog.values()) {
    const requested = [...contract.requires.context.required, ...contract.requires.context.optional];
    for (const capability of requested) {
      if (!capabilities.has(capability)) throw new Error(`${contract.skill.id}: unknown context capability: ${capability}`);
    }
  }
}
