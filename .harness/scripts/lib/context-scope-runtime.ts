import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { normalizeRepoPath } from './evidence-runtime.ts';

export type ContextScopeSource = 'changed-files' | 'explicit' | 'combined' | 'none';

interface ModuleDef {
  name?: unknown;
  path?: unknown;
  depends_on?: unknown;
}

export interface ContextScopeArtifact {
  version: '1.1';
  task_id: string;
  generated_at: string;
  basis: {
    base_commit: string;
    sha256: string;
    changed_files: string[];
    change_content_sha256: string;
    architecture_sha256: string;
    explicit_scope: {
      modules: string[];
      tags: string[];
      files: string[];
    };
  };
  scope: {
    source: ContextScopeSource;
    files: string[];
    modules: string[];
    tags: string[];
    reasons: string[];
    module_resolution: {
      seed_modules: string[];
      path_matches: Array<{ module: string; module_path: string; files: string[] }>;
      direct_dependencies: Array<{ module: string; required_by: string[] }>;
    };
  };
}

export interface ContextScopeInput {
  baseCommit: string;
  explicitModules: string[];
  explicitTags: string[];
  explicitFiles: string[];
  architecturePath?: string;
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}
function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
function normalizeFiles(values: string[]): string[] {
  return sortedUnique(values.map(normalizeRepoPath).map(value => value.replace(/^\.\//, '')).filter(Boolean));
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
function changedFiles(root: string, baseCommit: string, taskDir: string): string[] {
  const trackedText = git(root, ['diff', '--name-only', baseCommit, '--']);
  const untrackedText = git(root, ['ls-files', '--others', '--exclude-standard']);
  const taskPrefix = `${normalizeRepoPath(path.relative(root, taskDir)).replace(/\/$/, '')}/`;
  return normalizeFiles([
    ...(trackedText ? trackedText.split('\n') : []),
    ...(untrackedText ? untrackedText.split('\n') : []),
  ]).filter(file => {
    if (file.startsWith(taskPrefix)) return false;
    if (file === taskPrefix.slice(0, -1)) return false;
    if (file.startsWith('.agents/skills/aclh-task/')) return false;
    if (file.startsWith('.harness/project/')) return false;
    return true;
  });
}
function contentHash(root: string, files: string[]): string {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`path\0${file}\0`);
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) {
      hash.update('deleted\0');
      continue;
    }
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) {
      hash.update('non-file\0');
      continue;
    }
    hash.update(fs.readFileSync(absolute));
    hash.update('\0');
  }
  return hash.digest('hex');
}
function semanticHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function sourceFor(changed: string[], modules: string[], tags: string[], files: string[]): ContextScopeSource {
  const hasChanged = changed.length > 0;
  const hasExplicit = modules.length > 0 || tags.length > 0 || files.length > 0;
  if (hasChanged && hasExplicit) return 'combined';
  if (hasChanged) return 'changed-files';
  if (hasExplicit) return 'explicit';
  return 'none';
}
function loadArchitecture(architecturePath?: string): { sha256: string; modules: ModuleDef[] } {
  if (!architecturePath || !fs.existsSync(architecturePath)) {
    return { sha256: semanticHash({ missing: true }), modules: [] };
  }
  const raw = fs.readFileSync(architecturePath);
  let parsed: unknown;
  try {
    parsed = parseYaml(raw.toString('utf8'));
  } catch (error) {
    throw new Error(`architecture.yaml is invalid YAML: ${(error as Error).message}`);
  }
  const record = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as { modules?: unknown }
    : {};
  return {
    sha256: createHash('sha256').update(raw).digest('hex'),
    modules: Array.isArray(record.modules) ? record.modules as ModuleDef[] : [],
  };
}
function resolveModules(
  files: string[],
  explicitModules: string[],
  moduleDefs: ModuleDef[],
): ContextScopeArtifact['scope']['module_resolution'] & { modules: string[] } {
  const pathMatches: Array<{ module: string; module_path: string; files: string[] }> = [];
  const pathMatchedModules: string[] = [];

  for (const mod of moduleDefs) {
    const name = typeof mod.name === 'string' ? mod.name : '';
    const modulePath = typeof mod.path === 'string' ? normalizeRepoPath(mod.path).replace(/^\.\//, '').replace(/\/$/, '') : '';
    if (!name || !modulePath) continue;
    const matchedFiles = files.filter(file => file === modulePath || file.startsWith(`${modulePath}/`));
    if (matchedFiles.length === 0) continue;
    pathMatchedModules.push(name);
    pathMatches.push({ module: name, module_path: modulePath, files: matchedFiles });
  }

  const seedModules = sortedUnique([...explicitModules, ...pathMatchedModules]);
  const seedSet = new Set(seedModules);
  const dependencyOwners = new Map<string, Set<string>>();
  for (const mod of moduleDefs) {
    const name = typeof mod.name === 'string' ? mod.name : '';
    if (!name || !seedSet.has(name)) continue;
    for (const dependency of stringArray(mod.depends_on)) {
      const owners = dependencyOwners.get(dependency) ?? new Set<string>();
      owners.add(name);
      dependencyOwners.set(dependency, owners);
    }
  }
  const directDependencies = [...dependencyOwners.entries()]
    .map(([module, owners]) => ({ module, required_by: [...owners].sort() }))
    .sort((a, b) => a.module.localeCompare(b.module));

  return {
    modules: sortedUnique([...seedModules, ...directDependencies.map(item => item.module)]),
    seed_modules: seedModules,
    path_matches: pathMatches.sort((a, b) => a.module.localeCompare(b.module)),
    direct_dependencies: directDependencies,
  };
}

export function contextScopePath(taskDir: string): string {
  return path.join(taskDir, 'context-scope.json');
}

export function resolveContextScope(root: string, taskDir: string, taskId: string, input: ContextScopeInput): ContextScopeArtifact {
  if (!/^[0-9a-f]{40}$/.test(input.baseCommit)) throw new Error('task identity.base_commit is missing or invalid');
  const explicitModules = sortedUnique(input.explicitModules);
  const explicitTags = sortedUnique(input.explicitTags);
  const explicitFiles = normalizeFiles(input.explicitFiles);
  const changed = changedFiles(root, input.baseCommit, taskDir);
  const changeContentSha = contentHash(root, changed);
  const files = sortedUnique([...changed, ...explicitFiles]);
  const source = sourceFor(changed, explicitModules, explicitTags, explicitFiles);
  const architecture = loadArchitecture(input.architecturePath);
  const moduleResolution = resolveModules(files, explicitModules, architecture.modules);
  const reasons = [
    ...(changed.length ? [`changed-files:${changed.length}`] : []),
    ...(explicitFiles.length ? [`explicit-files:${explicitFiles.length}`] : []),
    ...(explicitModules.length ? [`explicit-modules:${explicitModules.length}`] : []),
    ...(explicitTags.length ? [`explicit-tags:${explicitTags.length}`] : []),
    ...(moduleResolution.path_matches.length ? [`architecture-path-matches:${moduleResolution.path_matches.length}`] : []),
    ...(moduleResolution.direct_dependencies.length ? [`one-hop-dependencies:${moduleResolution.direct_dependencies.length}`] : []),
  ];
  const resolvedScope = {
    source,
    files,
    modules: moduleResolution.modules,
    tags: explicitTags,
    reasons,
    module_resolution: {
      seed_modules: moduleResolution.seed_modules,
      path_matches: moduleResolution.path_matches,
      direct_dependencies: moduleResolution.direct_dependencies,
    },
  };
  const basisInput = {
    base_commit: input.baseCommit,
    changed_files: changed,
    change_content_sha256: changeContentSha,
    architecture_sha256: architecture.sha256,
    explicit_scope: { modules: explicitModules, tags: explicitTags, files: explicitFiles },
    resolved_scope: resolvedScope,
  };
  return {
    version: '1.1',
    task_id: taskId,
    generated_at: new Date().toISOString(),
    basis: {
      base_commit: input.baseCommit,
      sha256: semanticHash(basisInput),
      changed_files: changed,
      change_content_sha256: changeContentSha,
      architecture_sha256: architecture.sha256,
      explicit_scope: { modules: explicitModules, tags: explicitTags, files: explicitFiles },
    },
    scope: resolvedScope,
  };
}

export function loadContextScope(file: string, taskId: string): ContextScopeArtifact {
  if (!fs.existsSync(file)) throw new Error(`context-scope.json missing for ${taskId}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ContextScopeArtifact>;
  if (
    parsed.version !== '1.1' ||
    parsed.task_id !== taskId ||
    typeof parsed.generated_at !== 'string' ||
    !parsed.basis ||
    typeof parsed.basis.base_commit !== 'string' ||
    typeof parsed.basis.sha256 !== 'string' ||
    !Array.isArray(parsed.basis.changed_files) ||
    typeof parsed.basis.change_content_sha256 !== 'string' ||
    typeof parsed.basis.architecture_sha256 !== 'string' ||
    !parsed.basis.explicit_scope ||
    !parsed.scope ||
    !['changed-files', 'explicit', 'combined', 'none'].includes(String(parsed.scope.source)) ||
    !Array.isArray(parsed.scope.files) ||
    !Array.isArray(parsed.scope.modules) ||
    !Array.isArray(parsed.scope.tags) ||
    !Array.isArray(parsed.scope.reasons) ||
    !parsed.scope.module_resolution ||
    !Array.isArray(parsed.scope.module_resolution.seed_modules) ||
    !Array.isArray(parsed.scope.module_resolution.path_matches) ||
    !Array.isArray(parsed.scope.module_resolution.direct_dependencies)
  ) throw new Error('invalid Context Scope schema');
  return parsed as ContextScopeArtifact;
}

export function verifyContextScopeFresh(current: ContextScopeArtifact, recorded: ContextScopeArtifact): void {
  if (current.basis.sha256 !== recorded.basis.sha256) throw new Error('context-scope.json is stale for the current Task change set, explicit scope or architecture');
  if (JSON.stringify(current.scope) !== JSON.stringify(recorded.scope)) throw new Error('context-scope.json resolved scope does not match the current deterministic Scope');
}

export function contextScopeSemanticHash(scope: ContextScopeArtifact): string {
  return semanticHash({
    version: scope.version,
    task_id: scope.task_id,
    basis_sha256: scope.basis.sha256,
    scope: scope.scope,
  });
}
