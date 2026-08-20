#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

interface TemplateRef { src: string; dest: string; }
interface GovernanceConfig {
  default_risk_level?: unknown;
  risk_levels?: Record<string, unknown>;
  default_verification_strategy?: unknown;
  verification_strategies?: Record<string, { required_markers?: unknown }>;
}

const roots = resolveRuntimeRoots(import.meta.url);
const ROOT_DIR = roots.projectRoot;
const HARNESS_DIR = roots.runtimeHarnessDir;
const DOCS_DIR = roots.projectWipDir;

function git(args: string[]): string {
  const result = spawnSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}
function yamlSafe(value: string): string { return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"'); }

const args = process.argv.slice(2);
const taskId: string | undefined = args[0];
const riskIndex = args.indexOf('--risk');
const strategyIndex = args.indexOf('--strategy');
const requestedRisk = riskIndex >= 0 ? args[riskIndex + 1] : undefined;
const requestedStrategy = strategyIndex >= 0 ? args[strategyIndex + 1] : undefined;

if (!taskId) {
  console.error('Usage: node .harness/scripts/init-task.ts <TASK_ID> [--risk L0|L1|L2|L3] [--strategy tdd|component|config|migration|docs]');
  process.exit(1);
}
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error(`Invalid task ID: ${taskId}`);
  console.error('Task IDs may contain only letters, numbers, dots, underscores, and hyphens.');
  process.exit(1);
}

const governancePath = path.join(HARNESS_DIR, 'governance.yaml');
if (!fs.existsSync(governancePath)) { console.error(`Missing ACLH governance policy: ${governancePath}`); process.exit(1); }
const governance = parseYaml(fs.readFileSync(governancePath, 'utf8')) as GovernanceConfig;
const riskLevels = governance.risk_levels ?? {};
const strategies = governance.verification_strategies ?? {};
const defaultRisk = typeof governance.default_risk_level === 'string' ? governance.default_risk_level : 'L2';
const defaultStrategy = typeof governance.default_verification_strategy === 'string' ? governance.default_verification_strategy : 'tdd';
const riskLevel = requestedRisk ?? defaultRisk;
const verificationStrategy = requestedStrategy ?? (riskLevel === 'L0' ? 'docs' : defaultStrategy);
if (!(riskLevel in riskLevels)) {
  console.error(`Invalid risk level: ${riskLevel}`);
  console.error(`Allowed risk levels: ${Object.keys(riskLevels).join(', ')}`);
  process.exit(1);
}
if (!(verificationStrategy in strategies)) {
  console.error(`Invalid verification strategy: ${verificationStrategy}`);
  console.error(`Allowed strategies: ${Object.keys(strategies).join(', ')}`);
  process.exit(1);
}

let branch: string;
let baseCommit: string;
try {
  const ciHeadBranch = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_HEAD_REF
    ? process.env.GITHUB_HEAD_REF.trim()
    : '';
  branch = ciHeadBranch || git(['branch', '--show-current']);
  baseCommit = git(['rev-parse', 'HEAD']);
} catch (error) {
  console.error(`Cannot resolve Git task identity: ${(error as Error).message}`);
  process.exit(1);
}
if (!branch) {
  console.error('Cannot initialize a task from detached HEAD without a branch identity. Checkout a branch first.');
  process.exit(1);
}

fs.mkdirSync(DOCS_DIR, { recursive: true });
const taskDir: string = path.resolve(DOCS_DIR, taskId);
const relativeTaskDir: string = path.relative(DOCS_DIR, taskDir);
if (relativeTaskDir.startsWith('..') || path.isAbsolute(relativeTaskDir)) { console.error(`Invalid task path: ${taskId}`); process.exit(1); }
if (fs.existsSync(taskDir)) { console.warn(`[Warning] Task directory ${taskDir} already exists. Will not overwrite.`); process.exit(1); }
fs.mkdirSync(taskDir, { recursive: true });

const createdFiles: string[] = [];
const templates: TemplateRef[] = [
  { src: 'spec.md', dest: 'spec.md' },
  { src: 'task-tdd.md', dest: 'tasks.md' },
];
for (const t of templates) {
  const srcPath = path.join(HARNESS_DIR, 'plugins/templates', t.src);
  const destPath = path.join(taskDir, t.dest);
  fs.writeFileSync(destPath, fs.existsSync(srcPath) ? fs.readFileSync(srcPath, 'utf8') : `# ${t.dest}\n`);
  createdFiles.push(t.dest);
}

const strategy = strategies[verificationStrategy];
const markers = Array.isArray(strategy?.required_markers) ? strategy.required_markers.filter((m): m is string => typeof m === 'string') : [];
const markerSection = markers.map(marker => `- [ ] ${marker}: describe how this verification is satisfied`).join('\n');
const testPlanSrc = path.join(HARNESS_DIR, 'plugins/templates', 'test-plan.md');
const basePlan = fs.existsSync(testPlanSrc) ? fs.readFileSync(testPlanSrc, 'utf8') : '# Test Plan\n\n';
fs.writeFileSync(
  path.join(taskDir, 'test-plan.md'),
  `${basePlan.trimEnd()}\n\n## Verification Strategy\n\nstrategy: ${verificationStrategy}\n\n${markerSection}\n`,
);
createdFiles.push('test-plan.md');

fs.writeFileSync(
  path.join(taskDir, 'changelog.md'),
  `# Changelog\n\n- ${new Date().toISOString().split('T')[0]}: Initialized task ${taskId} (risk ${riskLevel}, strategy ${verificationStrategy}, branch ${branch})\n`,
);
createdFiles.push('changelog.md');

const templatePath = path.join(roots.runtimeRoot, 'docs/wip/.state-template.yaml');
const now = new Date().toISOString();
if (!fs.existsSync(templatePath)) {
  console.error(`Missing ACLH task state template: ${templatePath}`);
  fs.rmSync(taskDir, { recursive: true, force: true });
  process.exit(1);
}
let stateContent = fs.readFileSync(templatePath, 'utf8');
const replacements: Record<string,string> = {
  '{{TASK_ID}}': yamlSafe(taskId),
  '{{RISK_LEVEL}}': yamlSafe(riskLevel),
  '{{VERIFICATION_STRATEGY}}': yamlSafe(verificationStrategy),
  '{{BRANCH}}': yamlSafe(branch),
  '{{BASE_COMMIT}}': baseCommit,
  '{{CREATED_AT}}': now,
  '{{UPDATED_AT}}': now,
};
for (const [token,value] of Object.entries(replacements)) stateContent = stateContent.replaceAll(token,value);
if (/\{\{[A-Z_]+\}\}/.test(stateContent)) {
  console.error('Unresolved placeholder in .state-template.yaml');
  fs.rmSync(taskDir, { recursive: true, force: true });
  process.exit(1);
}
fs.writeFileSync(path.join(taskDir, '.state.yaml'), stateContent);
createdFiles.push('.state.yaml');

fs.writeFileSync(path.join(taskDir, 'evidence.json'), `${JSON.stringify({ version: '1.1', task_id: taskId, updated_at: null, gates: {} }, null, 2)}\n`);
createdFiles.push('evidence.json');

console.log(`Task ${taskId} initialized at ${path.relative(ROOT_DIR, taskDir).replaceAll('\\', '/')} (risk ${riskLevel}, strategy ${verificationStrategy}, branch ${branch})`);
console.log('Files created:');
for (const f of createdFiles) console.log(`  - ${f}`);
