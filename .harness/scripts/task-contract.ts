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

const outputRegistry = parseYaml(fs.readFileSync(path.join(roots.runtimeHarnessDir, 'artifacts', 'skill-outputs.yaml'), 'utf8')) as {
  artifacts?: Record<string, { path?: unknown; required_sections?: unknown }>;
};

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
  version: '1.2',
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
  planning: {
    contract: 'spec-plan-tasks-v1',
    order: ['spec.md', 'plan.md', 'tasks.md'],
    verify: 'task-planning.ts <TASK_ID> --verify',
  },
  authoring: {
    classification_yaml: {
      required_fields: ['version', 'task_id', 'classification.primary', 'classification.traits', 'classification.confidence', 'classification.rationale', 'classification.ambiguities', 'classification.source'],
      example: {
        version: '1.0',
        task_id: '<TASK_ID>',
        classification: {
          primary: 'feature',
          traits: ['behavior-change'],
          confidence: 'high',
          rationale: ['One concise reason grounded in the request.'],
          ambiguities: [],
          source: 'codex',
        },
      },
    },
    skill_plan_yaml: {
      instruction: 'Write only selected; Runtime owns resolved dependency order.',
      example: {
        version: '1.0',
        task_id: '<TASK_ID>',
        classification: { ref: 'classification.yaml' },
        selected: ['task-decomposition'],
      },
    },
    verification_gaps_yaml: {
      instruction: 'Browser is opt-in. Add machine_proofs: [browser] only when the request or acceptance criteria explicitly require browser interaction or visual verification. Empty entries are valid for tasks with no extra verification dimension.',
      example_without_browser: {
        version: '1.1',
        task_id: '<TASK_ID>',
        assessment: { source: 'codex', summary: 'Canonical gates cover the requested behavior; no extra proof is required.' },
        entries: [],
      },
      browser_entry_shape: {
        id: 'browser-behavior',
        dimension: 'ui-interaction',
        description: 'The explicitly requested browser behavior works.',
        status: 'machine-covered',
        machine_proofs: ['browser'],
      },
    },
    skill_outputs: Object.fromEntries(skills.map(skill => {
      const produces = typeof skill.produces === 'object' && skill.produces !== null
        ? skill.produces as { artifacts?: unknown; facts?: unknown }
        : {};
      const artifactIds = Array.isArray(produces.artifacts) ? produces.artifacts.filter(id => typeof id === 'string') as string[] : [];
      return [String(skill.id), {
        artifacts: artifactIds.map(id => ({ id, ...outputRegistry.artifacts?.[id] })),
        facts: produces.facts,
      }];
    })),
  },
  review: {
    verdicts: ['READY', 'READY_WITH_FINDINGS', 'NOT_READY'],
    finding_categories: ['defect', 'risk', 'edge-case', 'optimization', 'question'],
    finding_severities: ['blocking', 'major', 'minor', 'suggestion'],
    user_decision_required: true,
  },
  rules: {
    classification_selects_skills: false,
    skill_selection: 'explicit-minimal',
    builder_may_create_independent_pass: false,
    reviewer_may_modify_builder_files: false,
    repair_requires_explicit_user_decision: true,
    browser_verification: 'explicit-opt-in',
    read_runtime_source_for_normal_bootstrap: false,
  },
};

if (json) console.log(JSON.stringify(contract));
else {
  console.log(`ACLH task contract: risks=${Object.keys(riskLevels).join(',')}; strategies=${Object.keys(strategies).join(',')}; skills=${skills.map(skill => skill.id).join(',')}`);
}
