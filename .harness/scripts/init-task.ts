#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

interface TemplateRef { src: string; dest: string; }
interface GovernanceConfig {
  default_risk_level?: unknown;
  risk_levels?: Record<string, unknown>;
  default_verification_strategy?: unknown;
  verification_strategies?: Record<string, { required_markers?: unknown }>;
}

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);
const ROOT_DIR: string = path.resolve(__dirname, '../../');
const HARNESS_DIR: string = path.join(ROOT_DIR, '.harness');
const DOCS_DIR: string = path.join(ROOT_DIR, 'docs/wip');

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
if (!fs.existsSync(governancePath)) { console.error('Missing .harness/governance.yaml'); process.exit(1); }
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
  `# Changelog\n\n- ${new Date().toISOString().split('T')[0]}: Initialized task ${taskId} (risk ${riskLevel}, strategy ${verificationStrategy})\n`,
);
createdFiles.push('changelog.md');

const templatePath = path.join(DOCS_DIR, '.state-template.yaml');
const now = new Date().toISOString();
const today = now.split('T')[0];
if (fs.existsSync(templatePath)) {
  let stateContent: string = fs.readFileSync(templatePath, 'utf8');
  stateContent = `task_id: "${taskId}"\nrisk_level: "${riskLevel}"\nverification_strategy: "${verificationStrategy}"\ncreated_at: "${now}"\nupdated_at: "${now}"\n` + stateContent;
  stateContent = stateContent.replace(/2023-10-25/g, today);
  fs.writeFileSync(path.join(taskDir, '.state.yaml'), stateContent);
} else {
  fs.writeFileSync(
    path.join(taskDir, '.state.yaml'),
    `task_id: "${taskId}"\nrisk_level: "${riskLevel}"\nverification_strategy: "${verificationStrategy}"\nphase: "requirements"\nstatus: "active"\ncreated_at: "${now}"\nupdated_at: "${now}"\n`,
  );
}
createdFiles.push('.state.yaml');

fs.writeFileSync(path.join(taskDir, 'evidence.json'), `${JSON.stringify({ version: '1.1', task_id: taskId, updated_at: null, gates: {} }, null, 2)}\n`);
createdFiles.push('evidence.json');

console.log(`Task ${taskId} initialized at docs/wip/${taskId}/ (risk ${riskLevel}, strategy ${verificationStrategy})`);
console.log('Files created:');
for (const f of createdFiles) console.log(`  - ${f}`);
