import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const ENGINE_ROOT = process.cwd();

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
function run(projectRoot: string, script: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(ENGINE_ROOT, '.harness/scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ACLH_RUNTIME_ROOT: ENGINE_ROOT, ACLH_PROJECT_ROOT: projectRoot },
  });
}

test('successful delivery records the final managed checkpoint automatically', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aclh-managed-delivery-'));
  const taskId = 'TASK-MANAGED-DELIVERY';
  try {
    git(projectRoot, ['init', '-b', 'agent/managed-delivery']);
    git(projectRoot, ['config', 'user.email', 'aclh-test@example.com']);
    git(projectRoot, ['config', 'user.name', 'ACLH Test']);
    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# managed delivery consumer\n');
    git(projectRoot, ['add', '.']);
    git(projectRoot, ['commit', '-m', 'initial consumer']);

    const init = run(projectRoot, 'init-task.ts', [taskId, '--risk', 'L0', '--strategy', 'docs']);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const planPath = path.join(projectRoot, 'docs/wip', taskId, 'test-plan.md');
    const plan = fs.readFileSync(planPath, 'utf8')
      .replace('- [ ] DOC_STRUCTURE:', '- [x] DOC_STRUCTURE:')
      .replace('- [ ] LINK_OR_EXAMPLE_CHECK:', '- [x] LINK_OR_EXAMPLE_CHECK:');
    fs.writeFileSync(planPath, plan);

    const evidence = run(projectRoot, 'evidence.ts', [taskId, '--gate', 'check']);
    assert.equal(evidence.status, 0, evidence.stderr || evidence.stdout);
    const delivery = run(projectRoot, 'delivery-gate.ts', [taskId]);
    assert.equal(delivery.status, 0, delivery.stderr || delivery.stdout);

    const gitPath = git(projectRoot, ['rev-parse', '--git-path', `aclh/managed/${taskId}.json`]);
    const snapshotPath = path.isAbsolute(gitPath) ? gitPath : path.resolve(projectRoot, gitPath);
    assert.equal(fs.existsSync(snapshotPath), true);
    assert.equal(git(projectRoot, ['status', '--short']).includes('managed-snapshot'), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
