#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { PRIMARY_TYPES, TRAITS } from './lib/classification-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

const roots = resolveRuntimeRoots(import.meta.url);
const json = process.argv.includes('--json');
if (process.argv.length > 2 && !json) {
  console.error('Usage: node .harness/scripts/task-contract.ts [--json]');
  process.exit(1);
}

const governance = parseYaml(fs.readFileSync(path.join(roots.runtimeHarnessDir, 'governance.yaml'), 'utf8')) as {
  default_risk_level?: unknown;
  risk_levels?: Record<string, Record<string, unknown>>;
  default_verification_strategy?: unknown;
  verification_strategies?: Record<string, Record<string, unknown>>;
};

const skillDir = path.join(roots.runtimeHarnessDir, 'skills');
const skills = fs.readdirSync(skillDir)
  .filter(file => file.endsWith('.yaml'))
  .sort()
  .map(file => {
    const document = parseYaml(fs.readFileSync(path.join(skillDir, file), 'utf8')) as {
      skill?: { id?: unknown; kind?: unknown };
      description?: unknown;
      requires?: unknown;
      produces?: unknown;
    };
    return {
      id: document.skill?.id,
      kind: document.skill?.kind,
      description: typeof document.description === 'string'
        ? document.description.replace(/\s+/g, ' ').trim()
        : '',
      requires: document.requires,
      produces: document.produces,
    };
  });

const riskLevels = Object.fromEntries(Object.entries(governance.risk_levels ?? {}).map(([id, value]) => [id, {
  description: value.description,
  required_gates: value.required_gates,
  context_required: value.context_required,
  builder_self_review: value.builder_self_review,
  independent_review: value.independent_review,
}]));
const strategies = Object.fromEntries(Object.entries(governance.verification_strategies ?? {}).map(([id, value]) => [id, {
  description: value.description,
  required_markers: value.required_markers,
}]));

const contract = {
  version: '1.0',
  classification: {
    primary: [...PRIMARY_TYPES],
    traits: [...TRAITS],
    confidence: ['high', 'medium', 'low'],
    source: 'codex',
  },
  default_risk_level: governance.default_risk_level,
  risk_levels: riskLevels,
  default_verification_strategy: governance.default_verification_strategy,
  verification_strategies: strategies,
  skills,
  rules: {
    classification_selects_skills: false,
    skill_selection: 'explicit-minimal',
    builder_may_create_independent_pass: false,
  },
};

if (json) console.log(JSON.stringify(contract));
else {
  console.log(`ACLH task contract: risks=${Object.keys(riskLevels).join(',')}; strategies=${Object.keys(strategies).join(',')}; skills=${skills.map(skill => skill.id).join(',')}`);
}
