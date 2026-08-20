import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { ContextCapability } from './skill-runtime.ts';

export type ContextSourceReadinessStatus = 'missing' | 'present-but-unusable' | 'ready';

export interface ContextSourceReadiness {
  id: string;
  resolver: ContextCapability['resolver'];
  source?: string;
  status: ContextSourceReadinessStatus;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
function nonEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}
function parseSource(file: string): { value?: unknown; error?: string } {
  try {
    return { value: parseYaml(fs.readFileSync(file, 'utf8')) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}
function profileUsable(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const project = isRecord(value.project) ? value.project : {};
  const hasName = nonEmptyString(project.name);
  const hasEngineeringSignal =
    nonEmptyString(project.type) ||
    nonEmptyString(project.maturity) ||
    nonEmptyRecord(value.tech_stack) ||
    nonEmptyRecord(value.commands) ||
    nonEmptyRecord(value.frameworks);
  return hasName && hasEngineeringSignal;
}
function architectureUsable(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const modules = Array.isArray(value.modules) ? value.modules : [];
  const hasModule = modules.some(item => {
    if (!isRecord(item)) return false;
    return nonEmptyString(item.name) && nonEmptyString(item.path);
  });
  const boundaries = isRecord(value.boundaries) ? value.boundaries : {};
  const rules = Array.isArray(boundaries.rules) ? boundaries.rules : [];
  const directions = Array.isArray(boundaries.dependency_direction) ? boundaries.dependency_direction : [];
  const hasBoundary = [...rules, ...directions].some(item => nonEmptyString(item) || (isRecord(item) && Object.keys(item).length > 0));
  return hasModule || hasBoundary;
}
function knowledgeUsable(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Array.isArray(value.entries);
}

export function assessContextSource(
  id: string,
  capability: ContextCapability,
  sourcePath?: string,
): ContextSourceReadiness {
  if (capability.resolver === 'changed-files') {
    return { id, resolver: capability.resolver, status: 'ready', reason: 'resolved from the current Task change set' };
  }
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { id, resolver: capability.resolver, source: capability.source, status: 'missing', reason: 'source file is missing' };
  }
  const parsed = parseSource(sourcePath);
  if (parsed.error) {
    return { id, resolver: capability.resolver, source: capability.source, status: 'present-but-unusable', reason: `invalid YAML: ${parsed.error}` };
  }

  let usable = false;
  if (capability.resolver === 'knowledge') usable = knowledgeUsable(parsed.value);
  else if (id === 'project-profile') usable = profileUsable(parsed.value);
  else if (id === 'architecture') usable = architectureUsable(parsed.value);
  else usable = isRecord(parsed.value) && Object.keys(parsed.value).length > 0;

  if (!usable) {
    const reason = capability.resolver === 'knowledge'
      ? 'knowledge source must contain an entries array; an empty entries array is valid'
      : id === 'project-profile'
        ? 'profile requires project.name plus at least one engineering signal'
        : id === 'architecture'
          ? 'architecture requires at least one valid module or boundary'
          : 'source contains no usable Context data';
    return { id, resolver: capability.resolver, source: capability.source, status: 'present-but-unusable', reason };
  }
  return { id, resolver: capability.resolver, source: capability.source, status: 'ready', reason: 'source satisfies the minimal readiness contract' };
}
