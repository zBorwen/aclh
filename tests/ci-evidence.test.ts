import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';

test('CI evidence verifier cannot be used as local self-attestation', () => {
  const env = { ...process.env };
  delete env.GITHUB_ACTIONS;
  delete env.GITHUB_SHA;

  const result = spawnSync(process.execPath, ['.harness/scripts/ci-evidence.ts'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must run inside GitHub Actions/);
});

test('CI evidence verifier requires server-provided provenance fields', () => {
  const source = fs.readFileSync('.harness/scripts/ci-evidence.ts', 'utf8');
  for (const name of [
    'GITHUB_REPOSITORY',
    'GITHUB_SHA',
    'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT',
    'GITHUB_WORKFLOW',
    'GITHUB_ACTOR',
    'GITHUB_SERVER_URL',
  ]) {
    assert.match(source, new RegExp(`requiredEnv\\('${name}'\\)`));
  }
});

test('Harness CI generates and always uploads independent CI evidence', () => {
  const workflow = parseYaml(fs.readFileSync('.github/workflows/harness-ci.yml', 'utf8')) as {
    jobs: {
      verify: {
        steps: Array<{
          name?: string;
          run?: string;
          uses?: string;
          if?: string;
          with?: Record<string, unknown>;
        }>;
      };
    };
  };

  const steps = workflow.jobs.verify.steps;
  const verifier = steps.find(step => step.name === 'Run canonical gates and generate CI evidence');
  const upload = steps.find(step => step.name === 'Upload CI evidence');

  assert.equal(verifier?.run, 'node .harness/scripts/ci-evidence.ts');
  assert.equal(upload?.if, 'always()');
  assert.match(String(upload?.uses), /^actions\/upload-artifact@v\d+$/);
  assert.equal(upload?.with?.path, '.harness/artifacts/ci-evidence.json');
  assert.equal(upload?.with?.['if-no-files-found'], 'error');
});
