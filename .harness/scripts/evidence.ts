#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  ALL_GATES,
  evidenceExclusions,
  loadEvidenceFile,
  normalizeRepoPath,
  repositorySnapshot,
  resolveGateCommandSpecs,
  sameSnapshot,
  verifyEvidenceGates,
  type GateName,
} from './lib/evidence-runtime.ts';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3';
interface GovernanceConfig { default_risk_level?: unknown; risk_levels?: Record<string,{ required_gates?: unknown }>; }

const roots = resolveRuntimeRoots(import.meta.url);
const ROOT = roots.projectRoot;
const WIP = roots.projectWipDir;
const GOVERNANCE = path.join(roots.runtimeHarnessDir,'governance.yaml');
const gateSpecs = resolveGateCommandSpecs(roots.runtimeRoot, roots.projectRoot);
const expectedCommands = Object.fromEntries(ALL_GATES.map(gate=>[gate,gateSpecs[gate].command])) as Record<GateName,string>;

function usage(): never {
  console.error('Usage: node .harness/scripts/evidence.ts <TASK_ID> --gate <check|typecheck|test>');
  console.error('   or: node .harness/scripts/evidence.ts <TASK_ID> --verify');
  process.exit(1);
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
const excludedRelativePaths=evidenceExclusions(ROOT,taskDir);
if(!fs.existsSync(taskDir)||!fs.existsSync(path.join(taskDir,'.state.yaml'))){
  console.error(`Task not found or not initialized: ${taskId}`);
  process.exit(1);
}
let policy:{risk:RiskLevel;gates:GateName[]};
try{policy=requiredGates(taskDir);}catch(error){console.error(`[Evidence] ${(error as Error).message}`);process.exit(1);}
let evidence;
try {
  const loaded=loadEvidenceFile(taskId,evidencePath);
  evidence=loaded.evidence;
  if(loaded.legacyV1) console.error(`[Evidence] ${taskId}: v1.0 evidence is stale by definition; recapture all gates for v1.1`);
} catch(error) {
  console.error(`Invalid evidence file for ${taskId}: ${(error as Error).message}`);
  process.exit(1);
}

if(args.includes('--verify')){
  let current;
  try{current=repositorySnapshot(ROOT,excludedRelativePaths);}catch(error){console.error(`[Evidence] Cannot fingerprint repository: ${(error as Error).message}`);process.exit(1);}
  console.log(`[Evidence] ${taskId}: risk ${policy.risk}, required gates = ${policy.gates.join(', ')}`);
  const statuses=verifyEvidenceGates(evidence,current,policy.gates,expectedCommands);
  let failed=false;
  for(const gate of policy.gates){
    const status=statuses.get(gate);
    if(status==='fresh') console.log(`[Evidence] ${taskId} ${gate}: fresh PASS evidence present`);
    else if(status==='stale'){failed=true;console.error(`[Evidence] ${taskId} ${gate}: stale evidence; repository changed after gate execution`);}
    else {failed=true;console.error(`[Evidence] ${taskId} ${gate}: missing or failing evidence`);}
  }
  process.exit(failed?1:0);
}

const gateIndex=args.indexOf('--gate');
if(gateIndex<0) usage();
const gate=args[gateIndex+1] as GateName;
if(!ALL_GATES.includes(gate)) usage();
let before;
try{before=repositorySnapshot(ROOT,excludedRelativePaths);}catch(error){console.error(`[Evidence] Cannot fingerprint repository: ${(error as Error).message}`);process.exit(1);}
const startedAt=new Date().toISOString();
const spec=gateSpecs[gate];
const result=spawnSync(spec.program,spec.args,{cwd:ROOT,stdio:'inherit',shell:process.platform==='win32'});
const exitCode=result.status??1;
const finishedAt=new Date().toISOString();
let after;
try{after=repositorySnapshot(ROOT,excludedRelativePaths);}catch(error){console.error(`[Evidence] Cannot fingerprint repository after gate: ${(error as Error).message}`);process.exit(1);}
const unchanged=sameSnapshot(before,after);
const passed=exitCode===0&&unchanged;
evidence.gates[gate]={gate,command:spec.command,started_at:startedAt,finished_at:finishedAt,exit_code:exitCode,result:passed?'PASS':'FAIL',repository:before,repository_unchanged:unchanged};
evidence.updated_at=finishedAt;
fs.writeFileSync(evidencePath,`${JSON.stringify(evidence,null,2)}\n`);
if(!unchanged) console.error(`[Evidence] ${taskId} ${gate}: repository changed while gate was running; evidence marked FAIL`);
console.log(`[Evidence] ${taskId} ${gate}: ${passed?'PASS':'FAIL'} recorded in ${normalizeRepoPath(path.relative(ROOT,evidencePath))}`);
process.exit(passed?0:1);
