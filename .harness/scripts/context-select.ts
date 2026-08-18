#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

interface ModuleDef { name?: unknown; path?: unknown; depends_on?: unknown; [key: string]: unknown; }
interface GenericEntry { id?: unknown; module?: unknown; modules?: unknown; tags?: unknown; category?: unknown; severity?: unknown; affected_files?: unknown; applies_to?: unknown; [key: string]: unknown; }
interface RankedEntry { score: number; reasons: string[]; entry: GenericEntry; }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const taskId = process.argv[2];
const mode = process.argv[3] ?? '--generate';
if (!taskId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId) || !['--generate','--verify'].includes(mode)) {
  console.error('Usage: node .harness/scripts/context-select.ts <TASK_ID> [--generate|--verify]');
  process.exit(1);
}

const taskDir = path.join(ROOT, 'docs/wip', taskId);
const statePath = path.join(taskDir, '.state.yaml');
const outputPath = path.join(taskDir, 'context.json');
if (!fs.existsSync(statePath)) { console.error(`Context FAIL: task state missing for ${taskId}`); process.exit(1); }

function git(args: string[]): string {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout;
}
function arrayOfStrings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; }
function loadYaml(relative: string): any {
  const file = path.join(ROOT, relative);
  return fs.existsSync(file) ? parseYaml(fs.readFileSync(file, 'utf8')) : {};
}
function normalize(p: string): string { return p.replaceAll('\\','/').replace(/^\.\//,''); }
function changedFiles(baseCommit: string): string[] {
  const tracked = git(['diff','--name-only',baseCommit,'--']).split('\n').filter(Boolean).map(normalize);
  const untracked = git(['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean).map(normalize);
  const excluded = new Set([
    normalize(path.relative(ROOT, outputPath)),
    normalize(path.relative(ROOT, path.join(taskDir,'evidence.json'))),
    normalize(path.relative(ROOT, path.join(taskDir,'review-packet.md'))),
    normalize(path.relative(ROOT, path.join(taskDir,'independent-review.json'))),
  ]);
  return [...new Set([...tracked,...untracked])].filter(file=>!excluded.has(file)).sort();
}
function basisHash(files: string[], modules: string[], tags: string[], explicitFiles: string[]): string {
  return createHash('sha256').update(JSON.stringify({files,modules:[...modules].sort(),tags:[...tags].sort(),explicitFiles:[...explicitFiles].sort()})).digest('hex');
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

const governance = loadYaml('.harness/governance.yaml') as {
  knowledge_retrieval?: { max_items_per_source?: unknown; scoring?: Record<string,unknown> };
};
const maxItemsRaw = governance.knowledge_retrieval?.max_items_per_source;
const maxItems = Number.isInteger(maxItemsRaw) && Number(maxItemsRaw) > 0 ? Number(maxItemsRaw) : 5;
const rawScoring = governance.knowledge_retrieval?.scoring ?? {};
const scoring: Record<string,number> = Object.fromEntries(Object.entries(rawScoring).filter(([,v])=>typeof v==='number'));

const state = loadYaml(normalize(path.relative(ROOT,statePath))) as {
  identity?: { base_commit?: unknown };
  context_scope?: { modules?: unknown; tags?: unknown; files?: unknown };
};
const baseCommit = typeof state.identity?.base_commit === 'string' ? state.identity.base_commit : '';
if (!/^[0-9a-f]{40}$/.test(baseCommit)) { console.error('Context FAIL: task identity.base_commit is missing or invalid'); process.exit(1); }
const explicitModules = arrayOfStrings(state.context_scope?.modules);
const tags = arrayOfStrings(state.context_scope?.tags);
const explicitFiles = arrayOfStrings(state.context_scope?.files).map(normalize);
let changed: string[];
try { changed = changedFiles(baseCommit); }
catch (error) { console.error(`Context FAIL: ${(error as Error).message}`); process.exit(1); }
const effectiveFiles = [...new Set([...changed,...explicitFiles])].sort();

const architecture = loadYaml('.harness/project/architecture.yaml') as { modules?: unknown };
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

const bugLedger = loadYaml('.harness/project/bug-ledger.yaml');
const gotchas = loadYaml('.harness/project/gotchas.yaml');
const decisions = loadYaml('.harness/project/decisions.yaml');
const bugs = rankedTopK(bugLedger.entries,selectedModuleNames,tagSet,fileSet,scoring,maxItems);
const gotchaEntries = rankedTopK(gotchas.entries,selectedModuleNames,tagSet,fileSet,scoring,maxItems);
const decisionEntries = rankedTopK(decisions.entries,selectedModuleNames,tagSet,fileSet,scoring,maxItems);
const basis = basisHash(changed,explicitModules,tags,explicitFiles);
const selectedCount = bugs.items.length + gotchaEntries.items.length + decisionEntries.items.length;
const totalMatches = bugs.total_matches + gotchaEntries.total_matches + decisionEntries.total_matches;

if (mode === '--verify') {
  if (!fs.existsSync(outputPath)) { console.error('Context FAIL: context.json missing; run context-select.ts --generate'); process.exit(1); }
  let existing:any;
  try { existing=JSON.parse(fs.readFileSync(outputPath,'utf8')); }
  catch { console.error('Context FAIL: context.json is invalid JSON'); process.exit(1); }
  if (existing.version!=='1.1'||existing.task_id!==taskId||existing.basis?.sha256!==basis) {
    console.error('Context FAIL: context.json is stale for the current task scope/change set');
    process.exit(1);
  }
  console.log(`Context PASS for ${taskId}: ${selectedModules.length} module(s), ${selectedCount}/${totalMatches} knowledge match(es) selected.`);
  process.exit(0);
}

const output = {
  version:'1.1', task_id:taskId, generated_at:new Date().toISOString(),
  basis:{base_commit:baseCommit,sha256:basis,changed_files:changed,explicit_scope:{modules:explicitModules,tags,files:explicitFiles}},
  retrieval:{max_items_per_source:maxItems,scoring},
  selected:{
    profile:'.harness/project/profile.yaml',
    modules:selectedModules,
    knowledge:{bugs,gotchas:gotchaEntries,decisions:decisionEntries}
  }
};
fs.writeFileSync(outputPath,`${JSON.stringify(output,null,2)}\n`);
console.log(`Context generated for ${taskId}: ${selectedModules.length} module(s), ${selectedCount}/${totalMatches} knowledge match(es) -> ${normalize(path.relative(ROOT,outputPath))}`);
