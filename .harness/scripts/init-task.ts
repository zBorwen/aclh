#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface TemplateRef {
  src: string;
  dest: string;
}

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);
const ROOT_DIR: string = path.resolve(__dirname, '../../');
const HARNESS_DIR: string = path.join(ROOT_DIR, '.harness');
const DOCS_DIR: string = path.join(ROOT_DIR, 'docs/wip');

const taskId: string | undefined = process.argv[2];
if (!taskId) {
  console.error('Usage: node .harness/scripts/init-task.ts <TASK_ID>');
  process.exit(1);
}

if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
  console.error(`Invalid task ID: ${taskId}`);
  console.error('Task IDs may contain only letters, numbers, dots, underscores, and hyphens.');
  process.exit(1);
}

const taskDir: string = path.resolve(DOCS_DIR, taskId);
const relativeTaskDir: string = path.relative(DOCS_DIR, taskDir);
if (relativeTaskDir.startsWith('..') || path.isAbsolute(relativeTaskDir)) {
  console.error(`Invalid task path: ${taskId}`);
  process.exit(1);
}
if (fs.existsSync(taskDir)) {
  console.warn(`[Warning] Task directory ${taskDir} already exists. Will not overwrite.`);
  process.exit(1);
}

fs.mkdirSync(taskDir, { recursive: true });

const createdFiles: string[] = [];
const templates: TemplateRef[] = [
  { src: 'spec.md', dest: 'spec.md' },
  { src: 'task-tdd.md', dest: 'tasks.md' },
];

for (const t of templates) {
  const srcPath = path.join(HARNESS_DIR, 'plugins/templates', t.src);
  const destPath = path.join(taskDir, t.dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
  } else {
    fs.writeFileSync(destPath, `# ${t.dest}\n`);
  }
  createdFiles.push(t.dest);
}

const testPlanSrc = path.join(HARNESS_DIR, 'plugins/templates', 'test-plan.md');
if (fs.existsSync(testPlanSrc)) {
  fs.copyFileSync(testPlanSrc, path.join(taskDir, 'test-plan.md'));
} else {
  fs.writeFileSync(path.join(taskDir, 'test-plan.md'), '# Test Plan\n\n');
}
createdFiles.push('test-plan.md');

fs.writeFileSync(
  path.join(taskDir, 'changelog.md'),
  `# Changelog\n\n- ${new Date().toISOString().split('T')[0]}: Initialized task ${taskId}\n`,
);
createdFiles.push('changelog.md');

const templatePath = path.join(DOCS_DIR, '.state-template.yaml');
if (fs.existsSync(templatePath)) {
  let stateContent: string = fs.readFileSync(templatePath, 'utf8');
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  stateContent = `task_id: "${taskId}"\ncreated_at: "${now}"\nupdated_at: "${now}"\n` + stateContent;
  stateContent = stateContent.replace(/2023-10-25/g, today);
  fs.writeFileSync(path.join(taskDir, '.state.yaml'), stateContent);
} else {
  const now = new Date().toISOString();
  fs.writeFileSync(
    path.join(taskDir, '.state.yaml'),
    `task_id: "${taskId}"\nphase: "requirements"\nstatus: "active"\ncreated_at: "${now}"\nupdated_at: "${now}"\n`,
  );
}
createdFiles.push('.state.yaml');

fs.writeFileSync(
  path.join(taskDir, 'evidence.json'),
  `${JSON.stringify({ version: '1.0', task_id: taskId, updated_at: null, gates: {} }, null, 2)}\n`,
);
createdFiles.push('evidence.json');

console.log(`Task ${taskId} initialized successfully at docs/wip/${taskId}/`);
console.log('Files created:');
for (const f of createdFiles) {
  console.log(`  - ${f}`);
}
