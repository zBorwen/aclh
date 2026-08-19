import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeRepoPath } from './evidence-runtime.ts';

export type ContextScopeSource = 'changed-files' | 'explicit' | 'combined' | 'none';

export interface ContextScopeArtifact {
  version: '1.0';
  task_id: string;
  generated_at: string;
  basis: {
    base_commit: string;
    sha256: string;
    changed_files: string[];
    change_content_sha256: string;
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
  };
}

export interface ContextScopeInput {
  baseCommit: string;
  explicitModules: string[];
  explicitTags: string[];
  explicitFiles: string[];
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
  const reasons = [
    ...(changed.length ? [`changed-files:${changed.length}`] : []),
    ...(explicitFiles.length ? [`explicit-files:${explicitFiles.length}`] : []),
    ...(explicitModules.length ? [`explicit-modules:${explicitModules.length}`] : []),
    ...(explicitTags.length ? [`explicit-tags:${explicitTags.length}`] : []),
  ];
  const basisInput = {
    base_commit: input.baseCommit,
    changed_files: changed,
    change_content_sha256: changeContentSha,
    explicit_scope: { modules: explicitModules, tags: explicitTags, files: explicitFiles },
    resolved_scope: { source, files, modules: explicitModules, tags: explicitTags, reasons },
  };
  return {
    version: '1.0',
    task_id: taskId,
    generated_at: new Date().toISOString(),
    basis: {
      base_commit: input.baseCommit,
      sha256: semanticHash(basisInput),
      changed_files: changed,
      change_content_sha256: changeContentSha,
      explicit_scope: { modules: explicitModules, tags: explicitTags, files: explicitFiles },
    },
    scope: { source, files, modules: explicitModules, tags: explicitTags, reasons },
  };
}

export function loadContextScope(file: string, taskId: string): ContextScopeArtifact {
  if (!fs.existsSync(file)) throw new Error(`context-scope.json missing for ${taskId}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ContextScopeArtifact>;
  if (
    parsed.version !== '1.0' ||
    parsed.task_id !== taskId ||
    typeof parsed.generated_at !== 'string' ||
    !parsed.basis ||
    typeof parsed.basis.base_commit !== 'string' ||
    typeof parsed.basis.sha256 !== 'string' ||
    !Array.isArray(parsed.basis.changed_files) ||
    typeof parsed.basis.change_content_sha256 !== 'string' ||
    !parsed.basis.explicit_scope ||
    !parsed.scope ||
    !['changed-files', 'explicit', 'combined', 'none'].includes(String(parsed.scope.source)) ||
    !Array.isArray(parsed.scope.files) ||
    !Array.isArray(parsed.scope.modules) ||
    !Array.isArray(parsed.scope.tags) ||
    !Array.isArray(parsed.scope.reasons)
  ) throw new Error('invalid Context Scope schema');
  return parsed as ContextScopeArtifact;
}

export function verifyContextScopeFresh(current: ContextScopeArtifact, recorded: ContextScopeArtifact): void {
  if (current.basis.sha256 !== recorded.basis.sha256) throw new Error('context-scope.json is stale for the current Task change set or explicit scope');
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
