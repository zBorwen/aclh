import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RuntimeRoots {
  runtimeRoot: string;
  projectRoot: string;
  runtimeHarnessDir: string;
  projectHarnessDir: string;
  projectWipDir: string;
}

function resolveConfiguredPath(value: string | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) return fallback;
  return path.resolve(value);
}

export function resolveRuntimeRoots(_callerUrl?: string): RuntimeRoots {
  const helperDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultRuntimeRoot = path.resolve(helperDir, '../../..');
  const runtimeRoot = resolveConfiguredPath(process.env.ACLH_RUNTIME_ROOT, defaultRuntimeRoot);
  const projectRoot = resolveConfiguredPath(process.env.ACLH_PROJECT_ROOT, runtimeRoot);

  return {
    runtimeRoot,
    projectRoot,
    runtimeHarnessDir: path.join(runtimeRoot, '.harness'),
    projectHarnessDir: path.join(projectRoot, '.harness'),
    projectWipDir: path.join(projectRoot, 'docs/wip'),
  };
}

export function resolveRuntimeRelative(root: string, configured: string | undefined, fallbackRelative: string): string {
  if (!configured || configured.trim().length === 0) return path.join(root, fallbackRelative);
  return path.isAbsolute(configured) ? path.normalize(configured) : path.resolve(root, configured);
}
