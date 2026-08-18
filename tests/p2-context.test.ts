import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

function run(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', env: env ?? process.env });
}
function taskDir(taskId: string) { return path.join('docs/wip', taskId); }
function cleanup(taskId: string) { fs.rmSync(taskDir(taskId), { recursive: true, force: true }); }

test('context selector expands one-hop dependencies, ranks matches, caps top-k, and detects stale scope', () => {
  const taskId = `TEST-P2-CONTEXT-${process.pid}`;
  const dir = taskDir(taskId);
  cleanup(taskId);
  try {
    assert.equal(run(['.harness/scripts/init-task.ts', taskId, '--risk', 'L1', '--strategy', 'tdd']).status, 0);
    const statePath = path.join(dir, '.state.yaml');
    const state = parseYaml(fs.readFileSync(statePath, 'utf8')) as any;
    state.context_scope = { modules: ['Auth'], tags: ['react'], files: ['src/auth/login.ts'] };
    fs.writeFileSync(statePath, stringifyYaml(state));

    const fixture = path.join(dir, 'fixture-project');
    fs.mkdirSync(fixture, { recursive: true });
    fs.writeFileSync(path.join(fixture, 'profile.yaml'), 'name: fixture\n');
    fs.writeFileSync(path.join(fixture, 'architecture.yaml'), stringifyYaml({
      modules: [
        { name: 'Auth', path: 'src/auth', depends_on: ['Core'] },
        { name: 'Core', path: 'src/core', depends_on: [] },
        { name: 'Billing', path: 'src/billing', depends_on: [] }
      ]
    }));
    fs.writeFileSync(path.join(fixture, 'bug-ledger.yaml'), stringifyYaml({
      entries: [
        { id: 'BUG-CRITICAL', module: 'Auth', severity: 'critical', affected_files: ['src/auth/login.ts'] },
        { id: 'BUG-02', module: 'Auth' }, { id: 'BUG-03', module: 'Auth' },
        { id: 'BUG-04', module: 'Auth' }, { id: 'BUG-05', module: 'Auth' },
        { id: 'BUG-06', module: 'Auth' }, { id: 'BUG-07', module: 'Auth' },
        { id: 'BUG-OTHER', module: 'Billing' }
      ]
    }));
    fs.writeFileSync(path.join(fixture, 'gotchas.yaml'), stringifyYaml({
      entries: [{ id: 'GOTCHA-REACT', category: 'react', applies_to: ['src/auth/**/*.ts'] }]
    }));
    fs.writeFileSync(path.join(fixture, 'decisions.yaml'), stringifyYaml({
      entries: [{ id: 'ADR-AUTH', modules: ['Auth'], tags: ['react'] }]
    }));

    const env = { ...process.env, ACLH_PROJECT_DIR: fixture };
    const generate = run(['.harness/scripts/context-select.ts', taskId, '--generate'], env);
    assert.equal(generate.status, 0, generate.stderr || generate.stdout);
    const context = JSON.parse(fs.readFileSync(path.join(dir, 'context.json'), 'utf8')) as any;
    assert.equal(context.version, '1.1');
    assert.deepEqual(context.selected.modules.map((m: any) => m.name).sort(), ['Auth', 'Core']);
    assert.equal(context.selected.knowledge.bugs.total_matches, 7);
    assert.equal(context.selected.knowledge.bugs.items.length, 5);
    assert.equal(context.selected.knowledge.bugs.items[0].entry.id, 'BUG-CRITICAL');
    assert.ok(context.selected.knowledge.bugs.items[0].score > context.selected.knowledge.bugs.items[1].score);
    assert.equal(context.selected.knowledge.gotchas.items[0].entry.id, 'GOTCHA-REACT');
    assert.equal(context.selected.knowledge.decisions.items[0].entry.id, 'ADR-AUTH');

    const fresh = run(['.harness/scripts/context-select.ts', taskId, '--verify'], env);
    assert.equal(fresh.status, 0, fresh.stderr || fresh.stdout);

    const changedState = parseYaml(fs.readFileSync(statePath, 'utf8')) as any;
    changedState.context_scope.tags.push('security');
    fs.writeFileSync(statePath, stringifyYaml(changedState));
    const stale = run(['.harness/scripts/context-select.ts', taskId, '--verify'], env);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /context\.json is stale/);
  } finally {
    cleanup(taskId);
  }
});
