#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const HARNESS_DIR = path.join(ROOT_DIR, '.harness');
const DOCS_DIR = path.join(ROOT_DIR, 'docs/wip');

const taskId = process.argv[2];
if (!taskId) {
  console.error("Usage: node .harness/scripts/init-task.mjs <TASK_ID>");
  process.exit(1);
}

const taskDir = path.join(DOCS_DIR, taskId);
if (fs.existsSync(taskDir)) {
  console.warn(`[Warning] Task directory ${taskDir} already exists. Will not overwrite.`);
  process.exit(1);
}

fs.mkdirSync(taskDir, { recursive: true });

let createdFiles = [];

// Copy templates
const templates = [
  { src: 'spec.md', dest: 'spec.md' },
  { src: 'task-tdd.md', dest: 'tasks.md' }
];

templates.forEach(t => {
  const srcPath = path.join(HARNESS_DIR, 'plugins/templates', t.src);
  const destPath = path.join(taskDir, t.dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
  } else {
    // Create empty if template doesn't exist
    fs.writeFileSync(destPath, `# ${t.dest}\n`);
  }
  createdFiles.push(t.dest);
});

// Create test-plan.md
fs.writeFileSync(path.join(taskDir, 'test-plan.md'), '# Test Plan\n\n');
createdFiles.push('test-plan.md');

// Create changelog.md
fs.writeFileSync(path.join(taskDir, 'changelog.md'), `# Changelog\n\n- ${new Date().toISOString().split('T')[0]}: Initialized task ${taskId}\n`);
createdFiles.push('changelog.md');

// Create .state.yaml
const templatePath = path.join(DOCS_DIR, '.state-template.yaml');
let stateContent = '';
if (fs.existsSync(templatePath)) {
  stateContent = fs.readFileSync(templatePath, 'utf8');
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  stateContent = `task_id: "${taskId}"\ncreated_at: "${now}"\nupdated_at: "${now}"\n` + stateContent;
  // Replace dummy dates in template with today
  stateContent = stateContent.replace(/2023-10-25/g, today);
} else {
  const now = new Date().toISOString();
  stateContent = `task_id: "${taskId}"
phase: "requirements"
status: "active"
created_at: "${now}"
updated_at: "${now}"
`;
}
fs.writeFileSync(path.join(taskDir, '.state.yaml'), stateContent);
createdFiles.push('.state.yaml');

console.log(`Task ${taskId} initialized successfully at docs/wip/${taskId}/`);
console.log(`Files created:`);
createdFiles.forEach(f => console.log(`  - ${f}`));
