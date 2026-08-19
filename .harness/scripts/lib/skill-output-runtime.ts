import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { SkillContract } from './skill-runtime.ts';

export interface SkillOutputArtifactContract {
  id: string;
  path: string;
  requiredSections: string[];
}

const ROOT_KEYS = new Set(['version', 'artifacts']);
const ARTIFACT_KEYS = new Set(['path', 'required_sections']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(record).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${label} contains unknown field(s): ${unknown.join(', ')}`);
}
function nonEmptyStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
    throw new Error(`${label} must be a non-empty array of strings`);
  }
  const result = value as string[];
  const duplicates = result.filter((item, index) => result.indexOf(item) !== index);
  if (duplicates.length > 0) throw new Error(`${label} contains duplicate value(s): ${[...new Set(duplicates)].join(', ')}`);
  return result;
}

export function loadSkillOutputRegistry(registryPath: string): Map<string, SkillOutputArtifactContract> {
  if (!fs.existsSync(registryPath)) throw new Error(`Skill output registry not found: ${registryPath}`);
  let parsed: unknown;
  try { parsed = parseYaml(fs.readFileSync(registryPath, 'utf8')); }
  catch (error) { throw new Error(`Skill output registry invalid YAML: ${(error as Error).message}`); }
  if (!isRecord(parsed)) throw new Error('Skill output registry root must be an object');
  rejectUnknownKeys(parsed, ROOT_KEYS, 'Skill output registry root');
  if (parsed.version !== '1.0') throw new Error('Skill output registry version must be "1.0"');
  if (!isRecord(parsed.artifacts)) throw new Error('Skill output registry artifacts must be an object');

  const registry = new Map<string, SkillOutputArtifactContract>();
  for (const [id, raw] of Object.entries(parsed.artifacts)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Skill output artifact id must be kebab-case: ${id}`);
    if (!isRecord(raw)) throw new Error(`Skill output artifact ${id} must be an object`);
    rejectUnknownKeys(raw, ARTIFACT_KEYS, `Skill output artifact ${id}`);
    if (typeof raw.path !== 'string' || !/^[a-z0-9-]+\.md$/.test(raw.path)) {
      throw new Error(`Skill output artifact ${id} path must be a task-root kebab-case .md filename`);
    }
    const requiredSections = nonEmptyStringArray(raw.required_sections, `Skill output artifact ${id} required_sections`);
    registry.set(id, { id, path: raw.path, requiredSections });
  }
  return registry;
}

export function validateSkillOutputCoverage(
  catalog: Map<string, SkillContract>,
  registry: Map<string, SkillOutputArtifactContract>,
): void {
  const produced = new Set<string>();
  for (const skill of catalog.values()) {
    for (const artifact of skill.produces.artifacts) {
      produced.add(artifact);
      if (!registry.has(artifact)) throw new Error(`${skill.skill.id}: output artifact has no registry contract: ${artifact}`);
    }
  }
  for (const artifact of registry.keys()) {
    if (!produced.has(artifact)) throw new Error(`Skill output registry contains orphan artifact: ${artifact}`);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function verifyMarkdownArtifact(filePath: string, contract: SkillOutputArtifactContract): void {
  if (!fs.existsSync(filePath)) throw new Error(`required Skill output missing: ${contract.path}`);
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.trim().length === 0) throw new Error(`Skill output is empty: ${contract.path}`);
  const lines = content.split(/\r?\n/);

  for (const section of contract.requiredSections) {
    const heading = new RegExp(`^#{1,6}\\s+${escapeRegex(section)}\\s*$`);
    const start = lines.findIndex(line => heading.test(line));
    if (start < 0) throw new Error(`${contract.path}: missing required section: ${section}`);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^#{1,6}\s+/.test(lines[index])) { end = index; break; }
    }
    const body = lines.slice(start + 1, end).join('\n').trim();
    if (body.length === 0 || /^(TODO|TBD)$/i.test(body)) {
      throw new Error(`${contract.path}: required section has no completed content: ${section}`);
    }
  }
}

export function verifyResolvedSkillOutputs(
  taskDir: string,
  resolved: string[],
  catalog: Map<string, SkillContract>,
  registry: Map<string, SkillOutputArtifactContract>,
): void {
  const verifiedArtifacts = new Set<string>();
  for (const skillId of resolved) {
    const skill = catalog.get(skillId);
    if (!skill) throw new Error(`resolved skill missing from catalog: ${skillId}`);
    for (const artifactId of skill.produces.artifacts) {
      if (verifiedArtifacts.has(artifactId)) continue;
      const contract = registry.get(artifactId);
      if (!contract) throw new Error(`${skillId}: output artifact has no registry contract: ${artifactId}`);
      verifyMarkdownArtifact(path.join(taskDir, contract.path), contract);
      verifiedArtifacts.add(artifactId);
    }
  }
}
