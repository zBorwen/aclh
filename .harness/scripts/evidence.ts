#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

type GateName = 'check' | 'typecheck' | 'test';
type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3';
interface RepositorySnapshot { commit_sha: string; worktree_sha256: string; }
interface EvidenceEntry { gate: GateName; command: string; started_at: string; finished_at: string; exit_code: number; result: 'PASS'|'FAIL'; repository: RepositorySnapshot; repository_unchanged: boolean; }
interface EvidenceFile { version: '1.1'; task_id: string; updated_at: string|null; gates: Partial<Record<GateName, EvidenceEntry>>; }
interface GovernanceConfig { default_risk_level?: unknown; risk_levels?: Record<string,{ required_gates?: unknown }>; }

const GATES: Record<GateName,string> = { check:'npm run check', typecheck:'npm run typecheck', test:'npm test' };
const ALL_GATES: GateName[] = ['check','typecheck','test'];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname,'../..');
const WIP = path.join(ROOT,'docs/wip');
const GOVERNANCE = path.join(ROOT,'.harness/governance.yaml');

function usage(): never {
  console.error('Usage: node .harness/scripts/evidence.ts <TASK_ID> --gate <check|typecheck|test>');
  console.error('   or: node .harness/scripts/evidence.ts <TASK_ID> --verify');
  process.exit(1);
}
function runGitText(args:string[]):string { const r=spawnSync('git',args,{cwd:ROOT,encoding:'utf8'}); if(r.status!==0) throw new Error(r.stderr.trim()||`git ${args.join(' ')} failed`); return r.stdout; }
function normalizeRepoPath(p:string):string { return p.split(path.sep).join('/'); }
function repositorySnapshot(excludedRelativePaths:string[]):RepositorySnapshot {
  const commitSha=runGitText(['rev-parse','HEAD']).trim();
  const hasher=createHash('sha256');
  const pathspecs=excludedRelativePaths.map(p=>`:(exclude)${p}`);
  const diff=spawnSync('git',['diff','--binary','HEAD','--','.',...pathspecs],{cwd:ROOT,encoding:null});
  if(diff.status!==0) throw new Error(diff.stderr?.toString().trim()||'git diff failed');
  hasher.update(Buffer.from('tracked\0'));
  hasher.update(diff.stdout??Buffer.alloc(0));
  const excluded=new Set(excludedRelativePaths);
  const untracked=runGitText(['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean).map(normalizeRepoPath).filter(f=>!excluded.has(f)).sort();
  for(const file of untracked){ const full=path.join(ROOT,file); if(!fs.existsSync(full)||!fs.statSync(full).isFile()) continue; hasher.update(Buffer.from(`untracked\0${file}\0`)); hasher.update(fs.readFileSync(full)); }
  return {commit_sha:commitSha,worktree_sha256:hasher.digest('hex')};
}
function sameSnapshot(a:RepositorySnapshot,b:RepositorySnapshot):boolean{return a.commit_sha===b.commit_sha&&a.worktree_sha256===b.worktree_sha256;}
function loadEvidence(taskId:string,evidencePath:string):EvidenceFile{
  if(!fs.existsSync(evidencePath)) return {version:'1.1',task_id:taskId,updated_at:null,gates:{}};
  try{
    const parsed=JSON.parse(fs.readFileSync(evidencePath,'utf8')) as EvidenceFile;
    if(parsed.task_id!==taskId||!parsed.gates||typeof parsed.gates!=='object') throw new Error('invalid evidence schema');
    if(parsed.version!=='1.1') throw new Error(`unsupported evidence version: ${String(parsed.version)}`);
    return parsed;
  }catch(error){console.error(`Invalid evidence file for ${taskId}: ${(error as Error).message}`);process.exit(1);}
}
function requiredGates(taskDir:string): { risk: RiskLevel; gates: GateName[] } {
  const governance=parseYaml(fs.readFileSync(GOVERNANCE,'utf8')) as GovernanceConfig;
  const state=parseYaml(fs.readFileSync(path.join(taskDir,'.state.yaml'),'utf8')) as {risk_level?:unknown};
  const defaultRisk=typeof governance.default_risk_level==='string'?governance.default_risk_level:'L2';
  const risk=String(state.risk_level??defaultRisk) as RiskLevel;
  const configured=governance.risk_levels?.[risk]?.required_gates;
  if(!Array.isArray(configured)||configured.some(g=>typeof g!=='string'||!ALL_GATES.includes(g as GateName))){
    throw new Error(`invalid required_gates for risk ${risk}`);
  }
  return {risk,gates:configured as GateName[]};
}

const args=process.argv.slice(2);
const taskId=args[0];
if(!taskId||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) usage();
const taskDir=path.join(WIP,taskId);
const evidencePath=path.join(taskDir,'evidence.json');
const excludedRelativePaths=['evidence.json','review-packet.md','independent-review.json'].map(name=>normalizeRepoPath(path.relative(ROOT,path.join(taskDir,name))));
if(!fs.existsSync(taskDir)||!fs.existsSync(path.join(taskDir,'.state.yaml'))){console.error(`Task not found or not initialized: ${taskId}`);process.exit(1);}
let policy:{risk:RiskLevel;gates:GateName[]};
try{policy=requiredGates(taskDir);}catch(error){console.error(`[Evidence] ${(error as Error).message}`);process.exit(1);}
const evidence=loadEvidence(taskId,evidencePath);

if(args.includes('--verify')){
  let failed=false;
  let current:RepositorySnapshot;
  try{current=repositorySnapshot(excludedRelativePaths);}catch(error){console.error(`[Evidence] Cannot fingerprint repository: ${(error as Error).message}`);process.exit(1);}
  console.log(`[Evidence] ${taskId}: risk ${policy.risk}, required gates = ${policy.gates.join(', ')}`);
  for(const gate of policy.gates){
    const entry=evidence.gates[gate];
    const valid=Boolean(entry&&entry.gate===gate&&entry.command===GATES[gate]&&entry.exit_code===0&&entry.result==='PASS'&&entry.repository_unchanged===true&&typeof entry.started_at==='string'&&typeof entry.finished_at==='string'&&entry.repository&&typeof entry.repository.commit_sha==='string'&&typeof entry.repository.worktree_sha256==='string');
    if(!valid||!entry){failed=true;console.error(`[Evidence] ${taskId} ${gate}: missing or failing evidence`);continue;}
    if(!sameSnapshot(entry.repository,current)){failed=true;console.error(`[Evidence] ${taskId} ${gate}: stale evidence; repository changed after gate execution`);}
    else console.log(`[Evidence] ${taskId} ${gate}: fresh PASS evidence present`);
  }
  process.exit(failed?1:0);
}

const gateIndex=args.indexOf('--gate');
if(gateIndex<0) usage();
const gate=args[gateIndex+1] as GateName;
if(!ALL_GATES.includes(gate)) usage();
let before:RepositorySnapshot;
try{before=repositorySnapshot(excludedRelativePaths);}catch(error){console.error(`[Evidence] Cannot fingerprint repository: ${(error as Error).message}`);process.exit(1);}
const startedAt=new Date().toISOString();
const command=GATES[gate];
const [program,...commandArgs]=command.split(' ');
const result=spawnSync(program,commandArgs,{cwd:ROOT,stdio:'inherit',shell:process.platform==='win32'});
const exitCode=result.status??1;
const finishedAt=new Date().toISOString();
let after:RepositorySnapshot;
try{after=repositorySnapshot(excludedRelativePaths);}catch(error){console.error(`[Evidence] Cannot fingerprint repository after gate: ${(error as Error).message}`);process.exit(1);}
const unchanged=sameSnapshot(before,after);
const passed=exitCode===0&&unchanged;
evidence.gates[gate]={gate,command,started_at:startedAt,finished_at:finishedAt,exit_code:exitCode,result:passed?'PASS':'FAIL',repository:before,repository_unchanged:unchanged};
evidence.updated_at=finishedAt;
fs.writeFileSync(evidencePath,`${JSON.stringify(evidence,null,2)}\n`);
if(!unchanged) console.error(`[Evidence] ${taskId} ${gate}: repository changed while gate was running; evidence marked FAIL`);
console.log(`[Evidence] ${taskId} ${gate}: ${passed?'PASS':'FAIL'} recorded in ${normalizeRepoPath(path.relative(ROOT,evidencePath))}`);
process.exit(passed?0:1);
