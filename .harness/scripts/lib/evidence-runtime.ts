import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type GateName = 'check' | 'typecheck' | 'test';
export interface RepositorySnapshot { commit_sha: string; worktree_sha256: string; }
export interface EvidenceEntry {
  gate: GateName;
  command: string;
  started_at: string;
  finished_at: string;
  exit_code: number;
  result: 'PASS'|'FAIL';
  repository: RepositorySnapshot;
  repository_unchanged: boolean;
}
export interface EvidenceFile {
  version: '1.1';
  task_id: string;
  updated_at: string|null;
  gates: Partial<Record<GateName,EvidenceEntry>>;
}
export interface GateCommandSpec { command: string; program: string; args: string[]; }
export type GateEvidenceStatus = 'fresh'|'missing'|'stale';

export const GATES: Record<GateName,string> = {
  check:'npm run check',
  typecheck:'npm run typecheck',
  test:'npm test',
};
export const ALL_GATES: GateName[] = ['check','typecheck','test'];

export function resolveGateCommandSpecs(runtimeRoot:string,projectRoot:string):Record<GateName,GateCommandSpec> {
  const npmProgram = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const embedded = path.resolve(runtimeRoot) === path.resolve(projectRoot);
  return {
    check: embedded
      ? {command:GATES.check,program:npmProgram,args:['run','check']}
      : {
          command:`node ${normalizeRepoPath(path.join(runtimeRoot,'.harness/scripts/check.ts'))}`,
          program:process.execPath,
          args:[path.join(runtimeRoot,'.harness/scripts/check.ts')],
        },
    typecheck:{command:GATES.typecheck,program:npmProgram,args:['run','typecheck']},
    test:{command:GATES.test,program:npmProgram,args:['test']},
  };
}

function runGitText(root:string,args:string[]):string {
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});
  if(result.status!==0) throw new Error(result.stderr.trim()||`git ${args.join(' ')} failed`);
  return result.stdout;
}
export function normalizeRepoPath(value:string):string { return value.split(path.sep).join('/'); }

export function repositorySnapshot(root:string,excludedRelativePaths:string[]):RepositorySnapshot {
  const commitSha=runGitText(root,['rev-parse','HEAD']).trim();
  const hasher=createHash('sha256');
  const pathspecs=excludedRelativePaths.map(item=>`:(exclude)${item}`);
  const diff=spawnSync('git',['diff','--binary','HEAD','--','.',...pathspecs],{cwd:root,encoding:null});
  if(diff.status!==0) throw new Error(diff.stderr?.toString().trim()||'git diff failed');
  hasher.update(Buffer.from('tracked\0'));
  hasher.update(diff.stdout??Buffer.alloc(0));
  const excluded=new Set(excludedRelativePaths);
  const untracked=runGitText(root,['ls-files','--others','--exclude-standard','-z'])
    .split('\0').filter(Boolean).map(normalizeRepoPath).filter(file=>!excluded.has(file)).sort();
  for(const file of untracked){
    const full=path.join(root,file);
    if(!fs.existsSync(full)||!fs.statSync(full).isFile()) continue;
    hasher.update(Buffer.from(`untracked\0${file}\0`));
    hasher.update(fs.readFileSync(full));
  }
  return {commit_sha:commitSha,worktree_sha256:hasher.digest('hex')};
}
export function sameSnapshot(a:RepositorySnapshot,b:RepositorySnapshot):boolean {
  return a.commit_sha===b.commit_sha&&a.worktree_sha256===b.worktree_sha256;
}

export function evidenceExclusions(root:string,taskDir:string):string[] {
  return ['evidence.json','review-packet.md','independent-review.json']
    .map(name=>normalizeRepoPath(path.relative(root,path.join(taskDir,name))));
}

export function loadEvidenceFile(taskId:string,evidencePath:string):{evidence:EvidenceFile;legacyV1:boolean} {
  if(!fs.existsSync(evidencePath)) return {evidence:{version:'1.1',task_id:taskId,updated_at:null,gates:{}},legacyV1:false};
  const parsed=JSON.parse(fs.readFileSync(evidencePath,'utf8')) as {version?:unknown;task_id?:unknown;updated_at?:unknown;gates?:unknown};
  if(parsed.task_id!==taskId||!parsed.gates||typeof parsed.gates!=='object') throw new Error('invalid evidence schema');
  if(parsed.version==='1.0') return {evidence:{version:'1.1',task_id:taskId,updated_at:null,gates:{}},legacyV1:true};
  if(parsed.version!=='1.1') throw new Error(`unsupported evidence version: ${String(parsed.version)}`);
  return {evidence:parsed as EvidenceFile,legacyV1:false};
}

export function gateEvidenceStatus(
  entry:EvidenceEntry|undefined,
  gate:GateName,
  current:RepositorySnapshot,
  expectedCommand:string=GATES[gate],
):GateEvidenceStatus {
  const valid=Boolean(
    entry&&entry.gate===gate&&entry.command===expectedCommand&&entry.exit_code===0&&entry.result==='PASS'&&
    entry.repository_unchanged===true&&typeof entry.started_at==='string'&&typeof entry.finished_at==='string'&&
    entry.repository&&typeof entry.repository.commit_sha==='string'&&typeof entry.repository.worktree_sha256==='string'
  );
  if(!valid||!entry) return 'missing';
  return sameSnapshot(entry.repository,current)?'fresh':'stale';
}

export function verifyEvidenceGates(
  evidence:EvidenceFile,
  current:RepositorySnapshot,
  gates:GateName[],
  expectedCommands:Record<GateName,string>=GATES,
):Map<GateName,GateEvidenceStatus> {
  const result=new Map<GateName,GateEvidenceStatus>();
  for(const gate of gates) result.set(gate,gateEvidenceStatus(evidence.gates[gate],gate,current,expectedCommands[gate]));
  return result;
}
