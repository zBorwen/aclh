#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const args = process.argv.slice(2);
const action = args[0];
const projectIndex = args.indexOf('--project');
const roots = resolveRuntimeRoots(import.meta.url);
const projectRoot = projectIndex >= 0 && args[projectIndex + 1]
  ? path.resolve(args[projectIndex + 1])
  : roots.projectRoot;
const source = path.join(roots.runtimeRoot, '.harness/integrations/codex/aclh-task');
const destination = path.join(projectRoot, '.agents/skills/aclh-task');
const skillPath = path.join(destination, 'SKILL.md');

function usage(): never {
  console.error('Usage: node .harness/scripts/codex-integration.ts <attach|detach|status> [--project <path>]');
  process.exit(1);
}

function isManagedExternalIntegration(): boolean {
  if (!fs.existsSync(skillPath)) return false;
  return fs.readFileSync(skillPath, 'utf8').includes('# ACLH External Task Adapter');
}

if (!['attach', 'detach', 'status'].includes(action ?? '')) usage();

if (action === 'status') {
  const status = {
    runtime_root: roots.runtimeRoot,
    project_root: projectRoot,
    mode: path.resolve(projectRoot) === path.resolve(roots.runtimeRoot) ? 'embedded' : 'external',
    attached: isManagedExternalIntegration(),
    integration_path: destination,
  };
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}

if (path.resolve(projectRoot) === path.resolve(roots.runtimeRoot)) {
  console.error('Codex integration attach/detach is only for an external consumer project; embedded ACLH keeps its repository-owned Adapter.');
  process.exit(1);
}
if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
  console.error(`Consumer project does not exist: ${projectRoot}`);
  process.exit(1);
}

if (action === 'attach') {
  if (!fs.existsSync(source)) {
    console.error(`Missing ACLH Codex integration template: ${source}`);
    process.exit(1);
  }
  if (fs.existsSync(destination)) {
    console.error(`Refusing to overwrite existing Codex Skill: ${destination}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, errorOnExist: true });
  console.log(`AC... Codex integration attached at ${path.relative(projectRoot, destination).replaceAll('\\', '/')}`.replace('AC...', 'ACLH'));
  process.exit(0);
}

if (!fs.existsSync(destination)) {
  console.log('ACLH Codex integration already detached.');
  process.exit(0);
}
if (!isManagedExternalIntegration()) {
  console.error(`Refusing to remove non-ACLH or modified Codex Skill: ${destination}`);
  process.exit(1);
}
fs.rmSync(destination, { recursive: true, force: true });
const skillsDir = path.dirname(destination);
const agentsDir = path.dirname(skillsDir);
if (fs.existsSync(skillsDir) && fs.readdirSync(skillsDir).length === 0) fs.rmdirSync(skillsDir);
if (fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length === 0) fs.rmdirSync(agentsDir);
console.log('ACLH Codex integration detached; consumer project files were left untouched.');
