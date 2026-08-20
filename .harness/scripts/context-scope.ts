#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  contextScopePath,
  loadContextScope,
  resolveContextScope,
  verifyContextScopeFresh,
} from './lib/context-scope-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const taskId = process.argv[2];
const mode = process.argv[3] ?? '--generate';
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || !['--generate', '--verify'].includes(mode) || process.argv.length > 4) {
  console.error('Usage: node .harness/scripts/context-scope.ts <TASK_ID> [--generate|--verify]');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const statePath = path.join(taskDir, '.state.yaml');
if (!fs.existsSync(statePath)) {
  console.error(`Context Scope FAIL: task state missing for ${taskId}`);
  process.exit(1);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

try {
  const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as {
    identity?: { base_commit?: unknown };
    context_scope?: { modules?: unknown; tags?: unknown; files?: unknown };
  };
  const current = resolveContextScope(roots.projectRoot, taskDir, taskId, {
    baseCommit: typeof state.identity?.base_commit === 'string' ? state.identity.base_commit : '',
    explicitModules: strings(state.context_scope?.modules),
    explicitTags: strings(state.context_scope?.tags),
    explicitFiles: strings(state.context_scope?.files),
    architecturePath: path.join(roots.projectRoot, '.harness/project/architecture.yaml'),
  });
  const output = contextScopePath(taskDir);
  if (mode === '--verify') {
    const recorded = loadContextScope(output, taskId);
    verifyContextScopeFresh(current, recorded);
    console.log(`Context Scope PASS for ${taskId}: ${recorded.scope.source}, ${recorded.scope.files.length} file(s), ${recorded.scope.modules.length} module(s).`);
    process.exit(0);
  }

  fs.writeFileSync(output, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Context Scope generated for ${taskId}: ${current.scope.source}, ${current.scope.files.length} file(s), ${current.scope.modules.length} module(s) -> ${path.relative(roots.projectRoot, output).replaceAll('\\', '/')}`);
} catch (error) {
  console.error(`Context Scope FAIL: ${(error as Error).message}`);
  process.exit(1);
}
