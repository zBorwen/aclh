#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadClassification } from './lib/classification-runtime.ts';
import { loadSkillPlan } from './lib/skill-plan-runtime.ts';
import { resolveRuntimeRelative, resolveRuntimeRoots } from './lib/runtime-roots.ts';
import {
  loadContextCapabilities,
  loadSkillCatalog,
  resolveSkillIds,
  validateSkillContextCapabilities,
  type ContextCapability,
  type SkillContract,
} from './lib/skill-runtime.ts';

interface ModuleDef { name?: unknown; path?: unknown; depends_on?: unknown; [key: string]: unknown; }
interface GenericEntry { id?: unknown; module?: unknown; modules?: unknown; tags?: unknown; category?: unknown; severity?: unknown; affected_files?: unknown; applies_to?: unknown; [key: string]: unknown; }
interface RankedEntry { score: number; reasons: string[]; entry: GenericEntry; }
interface RequirementUsage { requiredBy: Set<string>; optionalBy: Set<string>; }

const roots = resolveRuntimeRoots(import.meta.url);
const ROOT = roots.projectRoot;
const PROJECT_DIR = process.env.ACLH_PROJECT_DIR
  ? (path.isAbsolute(process.env.ACLH_PROJECT_DIR) ? path.normalize(process.env.ACLH_PROJECT_DIR) : path.resolve(ROOT, process.env.ACLH_PROJECT_DIR))
  : path.join(ROOT, '.harness/project');
const SKILLS_DIR = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_SKILLS_DIR, '.harness/skills');
const CAPABILITY_REGISTRY = resolveRuntimeRelative(roots.runtimeRoot, process.env.ACLH_CONTEXT_CAPABILITIES, '.harness/context/capabilities.yaml');
const GOVERNANCE = path.join(roots.runtimeHarnessDir, 'governance.yaml');
const taskId = process.argv[2];
const mode = process.argv[3] ?? '--generate';
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || !['--generate','--verify'].includes(mode)) {
  console.error('Usage: node .harness/scripts/context-select.ts <TASK_ID> [--generate|--verify]');
  process.exit(1);
}

const taskDir = path.join(roots.projectWipDir, taskId);
const statePath = path.join(taskDir, '.state.yaml');
const outputPath = path.join(taskDir, 'context.json');
const skillPlanPath = path.join(taskDir, 'skill-plan.yaml');
const classificationPath = path.join(taskDir, 'classification.yaml');
if (!fs.existsSync(statePath)) { console.error(`Context FAIL: task state missing for ${taskId}`); process.exit(1); }

function fail(message: string): never { console.error(`Context FAIL: ${message}`); process.exit(1); }
function git(args: string[]): string {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout;
}
function arrayOfStrings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; }
function loadYamlFile(file: string): any { return fs.existsSync(file) ? parseYaml(fs.readFileSync(file, 'utf8')) : {}; }
function loadProjectYaml(name: string): any { return loadYamlFile(path.join(PROJECT_DIR, name)); }
function normalize(p: string): string { return p.replaceAll('\\','/').replace(/^\.\//,''); }
function hashValue(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function changedFiles(baseCommit: string, extraExcluded: string[] = []): string[] {
  const tracked = git(['diff','--name-only',baseCommit,'--']).split('\n').filter(Boolean).map(normalize);
  const untracked = git(['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean).map(normalize);
  const excluded = new Set([
    normalize(path.relative(ROOT, outputPath)),
    normalize(path.relative(ROOT, path.join(taskDir,'evidence.json'))),
    normalize(path.relative(ROOT, path.join(taskDir,'review-packet.md'))),
    normalize(path.relative(ROOT, path.join(taskDir,'independent-review.json'))),
    ...extraExcluded.map(normalize),
  ]);
  return [...new Set([...tracked,...untracked])].filter(file=>!excluded.has(file)).sort();
}
function changeContentHash(files: string[]): string {
  const hasher = createHash('sha256');
  for (const file of files) {
    hasher.update(Buffer.from(`path\0${file}\0`));
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) { hasher.update(Buffer.from('deleted\0')); continue; }
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) { hasher.update(Buffer.from('non-file\0')); continue; }
    hasher.update(fs.readFileSync(fullPath));
    hasher.update(Buffer.from('\0'));
  }
  return hasher.digest('hex');
}
function basisHashLegacy(files: string[], modules: string[], tags: string[], explicitFiles: string[]): string {
  return hashValue({files,modules:[...modules].sort(),tags:[...tags].sort(),explicitFiles:[...explicitFiles].sort()});
}
function basisHashP3(
  files: string[], modules: string[], tags: string[], explicitFiles: string[], changeSha: string,
  skillPlanSha: string, contextContractSha: string, retrievalPolicySha: string,
): string {
  return hashValue({
    files,
    modules:[...modules].sort(), tags:[...tags].sort(), explicitFiles:[...explicitFiles].sort(),
    change_content_sha256:changeSha,
    skill_plan_sha256:skillPlanSha,
    context_contract_sha256:contextContractSha,
    retrieval_policy_sha256:retrievalPolicySha,
  });
}
function matchesFilePattern(pattern: string, file: string): boolean {
  const prefix = normalize(pattern).split('*')[0].replace(/\/$/,'');
  return prefix.length > 0 && normalize(file).startsWith(prefix);
}
function rankEntry(entry: GenericEntry, modules: Set<string>, tags: Set<string>, files: Set<string>, scoring: Record<string,number>): RankedEntry | null {
  let score = 0;
  const reasons: string[] = [];
  const entryModules = new Set([...(typeof entry.module === 'string' ? [entry.module] : []), ...arrayOfStrings(entry.modules)]);
  if ([...entryModules].some(m=>modules.has(m))) { score += scoring.module_match ?? 5; reasons.push('module'); }
  const entryTags = new Set([...arrayOfStrings(entry.tags), ...(typeof entry.category === 'string' ? [entry.category] : [])]);
  if ([...entryTags].some(t=>tags.has(t))) { score += scoring.tag_match ?? 3; reasons.push('tag'); }
  const fileRefs = [...arrayOfStrings(entry.affected_files), ...arrayOfStrings(entry.applies_to)];
  if (fileRefs.some(ref=>[...files].some(file=>ref.includes('*') ? matchesFilePattern(ref,file) : normalize(ref)===normalize(file)))) { score += scoring.file_match ?? 4; reasons.push('file'); }
  if (entry.severity === 'high' || entry.severity === 'critical') { score += scoring.high_severity_bonus ?? 2; reasons.push('severity'); }
  return score > 0 ? {score,reasons,entry} : null;
}
function rankedTopK(entries: unknown, modules: Set<string>, tags: Set<string>, files: Set<string>, scoring: Record<string,number>, max: number): {items:RankedEntry[];total_matches:number} {
  const ranked = Array.isArray(entries)
    ? (entries as GenericEntry[]).map(entry=>rankEntry(entry,modules,tags,files,scoring)).filter((entry):entry is RankedEntry=>entry!==null)
    : [];
  ranked.sort((a,b)=>b.score-a.score || String(a.entry.id??'').localeCompare(String(b.entry.id??'')));
  return {items:ranked.slice(0,max),total_matches:ranked.length};
}
function sourceDisplay(sourcePath: string): string {
  const relative = path.relative(ROOT, sourcePath);
  return normalize(relative.startsWith('..') ? sourcePath : relative);
}
function sameStringArray(a: string[] | undefined, b: string[]): boolean {
  return Boolean(a && a.length === b.length && a.every((value,index)=>value===b[index]));
}
function collectRequirements(resolved: string[], catalog: Map<string,SkillContract>): Map<string,RequirementUsage> {
  const requirements = new Map<string,RequirementUsage>();
  function usage(id: string): RequirementUsage {
    const existing = requirements.get(id);
    if (existing) return existing;
    const created = {requiredBy:new Set<string>(),optionalBy:new Set<string>()};
    requirements.set(id,created);
    return created;
  }
  for (const skillId of resolved) {
    const contract = catalog.get(skillId);
    if (!contract) throw new Error(`resolved skill missing from catalog: ${skillId}`);
    for (const id of contract.requires.context.required) usage(id).requiredBy.add(skillId);
    for (const id of contract.requires.context.optional) usage(id).optionalBy.add(skillId);
  }
  return requirements;
}

const governance = loadYamlFile(GOVERNANCE) as {
  knowledge_retrieval?: { max_items_per_source?: unknown; scoring?: Record<string,unknown> };
};
const maxItemsRaw = governance.knowledge_retrieval?.max_items_per_source;
const maxItems = Number.isInteger(maxItemsRaw) && Number(maxItemsRaw) > 0 ? Number(maxItemsRaw) : 5;
const rawScoring = governance.knowledge_retrieval?.scoring ?? {};
const scoring: Record<string,number> = {};
for (const [key,value] of Object.entries(rawScoring)) if (typeof value === 'number') scoring[key] = value;
const retrievalPolicySha = hashValue({maxItems,scoring});

const state = loadYamlFile(statePath) as {
  identity?: { base_commit?: unknown };
  context_scope?: { modules?: unknown; tags?: unknown; files?: unknown };
};
const baseCommit = typeof state.identity?.base_commit === 'string' ? state.identity.base_commit : '';
if (!/^[0-9a-f]{40}$/.test(baseCommit)) fail('task identity.base_commit is missing or invalid');
const explicitModules = arrayOfStrings(state.context_scope?.modules);
const tags = arrayOfStrings(state.context_scope?.tags);
const explicitFiles = arrayOfStrings(state.context_scope?.files).map(normalize);
const isSkillAware = fs.existsSync(skillPlanPath);

let catalog: Map<string,SkillContract> | undefined;
let capabilities: Map<string,ContextCapability> | undefined;
let resolvedSkills: string[] = [];
let requirements: Map<string,RequirementUsage> | undefined;
let skillPlanSha = '';
let contextContractSha = '';

if (isSkillAware) {
  try {
    loadClassification(classificationPath, taskId);
    catalog = loadSkillCatalog(SKILLS_DIR);
    capabilities = loadContextCapabilities(CAPABILITY_REGISTRY);
    validateSkillContextCapabilities(catalog,capabilities);
    const plan = loadSkillPlan(skillPlanPath,taskId,true);
    const expected = resolveSkillIds(plan.selected,catalog);
    if (!sameStringArray(plan.resolved,expected)) throw new Error(`skill-plan resolved skills are stale; expected: ${expected.join(' -> ')}`);
    resolvedSkills = expected;
    requirements = collectRequirements(resolvedSkills,catalog);
    skillPlanSha = hashValue({version:plan.version,task_id:plan.task_id,classification:plan.classification,selected:plan.selected,resolved:expected});
    const contractBasis = resolvedSkills.map(id=>({id,context:catalog?.get(id)?.requires.context}));
    const capabilityBasis = [...requirements.keys()].sort().map(id=>capabilities?.get(id));
    contextContractSha = hashValue({contracts:contractBasis,capabilities:capabilityBasis});
  } catch (error) { fail((error as Error).message); }
}

let changed: string[];
try {
  const controlExclusions = isSkillAware
    ? [normalize(path.relative(ROOT,classificationPath)),normalize(path.relative(ROOT,skillPlanPath))]
    : [];
  changed = changedFiles(baseCommit,controlExclusions);
} catch (error) { fail((error as Error).message); }
const changeSha = isSkillAware ? changeContentHash(changed) : '';
const effectiveFiles = [...new Set([...changed,...explicitFiles])].sort();

const architecture = loadProjectYaml('architecture.yaml') as { modules?: unknown };
const moduleDefs = Array.isArray(architecture.modules) ? architecture.modules as ModuleDef[] : [];
const selectedNames = new Set(explicitModules);
for (const mod of moduleDefs) {
  const name = typeof mod.name === 'string' ? mod.name : '';
  const modulePath = typeof mod.path === 'string' ? normalize(mod.path).replace(/\/$/,'') : '';
  if (name && modulePath && effectiveFiles.some(file=>file===modulePath||file.startsWith(`${modulePath}/`))) selectedNames.add(name);
}
for (const mod of moduleDefs) {
  if (typeof mod.name !== 'string' || !selectedNames.has(mod.name)) continue;
  for (const dep of arrayOfStrings(mod.depends_on)) selectedNames.add(dep);
}
const selectedModules = moduleDefs.filter(mod=>typeof mod.name==='string'&&selectedNames.has(mod.name));
const selectedModuleNames = new Set(selectedModules.map(mod=>String(mod.name)));
const tagSet = new Set(tags);
const fileSet = new Set(effectiveFiles);

if (!isSkillAware) {
  const bugLedger = loadProjectYaml('bug-ledger.yaml');
  const gotchas = loadProjectYaml('gotchas.yaml');
  const decisions = loadProjectYaml('decisions.yaml');
  const bugs = rankedTopK(bugLedger.entries,selectedModuleNames,tagSet,fileSet,scoring,maxItems);
  const gotchaEntries = rankedTopK(gotchas.entries,selectedModuleNames,tagSet,fileSet,scoring,maxItems);
  const decisionEntries = rankedTopK(decisions.entries,selectedModuleNames,tagSet,fileSet,scoring,maxItems);
  const basis = basisHashLegacy(changed,explicitModules,tags,explicitFiles);
  const selectedCount = bugs.items.length + gotchaEntries.items.length + decisionEntries.items.length;
  const totalMatches = bugs.total_matches + gotchaEntries.total_matches + decisionEntries.total_matches;

  if (mode === '--verify') {
    if (!fs.existsSync(outputPath)) fail('context.json missing; run context-select.ts --generate');
    let existing:any;
    try { existing=JSON.parse(fs.readFileSync(outputPath,'utf8')); }
    catch { fail('context.json is invalid JSON'); }
    if (existing.version!=='1.1'||existing.task_id!==taskId||existing.basis?.sha256!==basis) fail('context.json is stale for the current task scope/change set');
    console.log(`Context PASS for ${taskId}: ${selectedModules.length} module(s), ${selectedCount}/${totalMatches} knowledge match(es) selected.`);
    process.exit(0);
  }

  const output = {
    version:'1.1', task_id:taskId, generated_at:new Date().toISOString(),
    basis:{base_commit:baseCommit,sha256:basis,changed_files:changed,explicit_scope:{modules:explicitModules,tags,files:explicitFiles}},
    retrieval:{max_items_per_source:maxItems,scoring},
    selected:{
      profile:sourceDisplay(path.join(PROJECT_DIR,'profile.yaml')),
      modules:selectedModules,
      knowledge:{bugs,gotchas:gotchaEntries,decisions:decisionEntries}
    }
  };
  fs.writeFileSync(outputPath,`${JSON.stringify(output,null,2)}\n`);
  console.log(`Context generated for ${taskId}: ${selectedModules.length} module(s), ${selectedCount}/${totalMatches} knowledge match(es) -> ${normalize(path.relative(ROOT,outputPath))}`);
  process.exit(0);
}

if (!catalog || !capabilities || !requirements) fail('skill-aware Context Runtime was not initialized');
const basis = basisHashP3(changed,explicitModules,tags,explicitFiles,changeSha,skillPlanSha,contextContractSha,retrievalPolicySha);
const requirementOutput: Record<string,unknown> = {};
const selectedOutput: Record<string,unknown> = {};
let selectedKnowledgeCount = 0;
let totalKnowledgeMatches = 0;

for (const id of [...requirements.keys()].sort()) {
  const usage = requirements.get(id)!;
  const capability = capabilities.get(id);
  if (!capability) fail(`Context capability disappeared after validation: ${id}`);
  const requiredBy = [...usage.requiredBy].sort();
  const optionalBy = [...usage.optionalBy].sort();
  requirementOutput[id] = {
    level:requiredBy.length>0?'required':'optional',
    required_by:requiredBy,
    optional_by:optionalBy,
    resolver:capability.resolver,
    ...(capability.source?{source:capability.source}:{}),
  };

  if (capability.resolver==='changed-files') {
    selectedOutput[id]={files:changed};
    continue;
  }

  const sourcePath = path.join(PROJECT_DIR,capability.source!);
  if (!fs.existsSync(sourcePath)) {
    if (requiredBy.length>0) fail(`required Context capability ${id} source missing: ${capability.source}`);
    selectedOutput[id]={available:false,source:sourceDisplay(sourcePath)};
    continue;
  }

  if (capability.resolver==='project-file') {
    selectedOutput[id] = id==='architecture'
      ? {source:sourceDisplay(sourcePath),modules:selectedModules}
      : {source:sourceDisplay(sourcePath)};
    continue;
  }

  const source = loadYamlFile(sourcePath) as {entries?:unknown};
  const ranked = rankedTopK(source.entries,selectedModuleNames,tagSet,fileSet,scoring,maxItems);
  selectedOutput[id]={source:sourceDisplay(sourcePath),...ranked};
  selectedKnowledgeCount+=ranked.items.length;
  totalKnowledgeMatches+=ranked.total_matches;
}

if (mode==='--verify') {
  if (!fs.existsSync(outputPath)) fail('context.json missing; run context-select.ts --generate');
  let existing:any;
  try { existing=JSON.parse(fs.readFileSync(outputPath,'utf8')); }
  catch { fail('context.json is invalid JSON'); }
  if (existing.version!=='2.0'||existing.task_id!==taskId||existing.mode!=='skill-aware'||existing.basis?.sha256!==basis) {
    fail('context.json is stale for the current Skill Plan, Context contract or repository content');
  }
  console.log(`Context PASS for ${taskId}: ${resolvedSkills.length} skill(s), ${Object.keys(requirementOutput).length} Context capability requirement(s).`);
  process.exit(0);
}

const output = {
  version:'2.0',task_id:taskId,mode:'skill-aware',generated_at:new Date().toISOString(),
  basis:{
    base_commit:baseCommit,sha256:basis,changed_files:changed,change_content_sha256:changeSha,
    skill_plan_sha256:skillPlanSha,context_contract_sha256:contextContractSha,retrieval_policy_sha256:retrievalPolicySha,
    explicit_scope:{modules:explicitModules,tags,files:explicitFiles},
  },
  skills:resolvedSkills,
  requirements:requirementOutput,
  retrieval:{max_items_per_source:maxItems,scoring,selected_knowledge_items:selectedKnowledgeCount,total_knowledge_matches:totalKnowledgeMatches},
  selected:selectedOutput,
};
fs.writeFileSync(outputPath,`${JSON.stringify(output,null,2)}\n`);
console.log(`Context generated for ${taskId}: ${resolvedSkills.length} skill(s), ${Object.keys(requirementOutput).length} Context capability requirement(s) -> ${normalize(path.relative(ROOT,outputPath))}`);
