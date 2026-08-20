import fs from 'node:fs';
import { gitLocalAclhPath } from './managed-snapshot-runtime.ts';
import { loadResyncReport, type ResyncReport } from './resync-runtime.ts';
import { loadSkillPlan, semanticSkillPlanHash, type SkillPlanArtifact } from './skill-plan-runtime.ts';

export type SkillReplanDecision = 'changed' | 'unchanged';
export type SkillReplanSource = 'codex' | 'human';

export interface SkillReplanCheckpoint {
  version: '1.0';
  task_id: string;
  decision: SkillReplanDecision;
  source: SkillReplanSource;
  reviewed_at: string;
  resync: {
    detected_at: string;
    commit_sha: string;
    worktree_sha256: string;
  };
  baseline_skill_plan_sha256: string;
  skill_plan: {
    sha256: string;
    selected: string[];
    resolved: string[];
  };
}

export function skillReplanPath(root: string, taskId: string): string {
  return gitLocalAclhPath(root, `replan/${taskId}.json`);
}

export function loadSkillReplanCheckpoint(root: string, taskId: string): SkillReplanCheckpoint | null {
  const file = skillReplanPath(root, taskId);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<SkillReplanCheckpoint>;
  if (
    parsed.version !== '1.0' ||
    parsed.task_id !== taskId ||
    !['changed', 'unchanged'].includes(String(parsed.decision)) ||
    !['codex', 'human'].includes(String(parsed.source)) ||
    typeof parsed.reviewed_at !== 'string' ||
    !parsed.resync ||
    typeof parsed.resync.detected_at !== 'string' ||
    typeof parsed.resync.commit_sha !== 'string' ||
    typeof parsed.resync.worktree_sha256 !== 'string' ||
    typeof parsed.baseline_skill_plan_sha256 !== 'string' ||
    !parsed.skill_plan ||
    typeof parsed.skill_plan.sha256 !== 'string' ||
    !Array.isArray(parsed.skill_plan.selected) ||
    !Array.isArray(parsed.skill_plan.resolved)
  ) throw new Error('invalid Skill Re-plan checkpoint schema');
  return parsed as SkillReplanCheckpoint;
}

export function assertDecisionMatchesBaseline(decision: SkillReplanDecision, baselineSha: string, currentSha: string): void {
  const changed = baselineSha !== currentSha;
  if (decision === 'changed' && !changed) throw new Error('decision=changed requires the semantic Skill Plan to differ from the Resync baseline');
  if (decision === 'unchanged' && changed) throw new Error('decision=unchanged requires the semantic Skill Plan to match the Resync baseline');
}

export function buildSkillReplanCheckpoint(
  report: ResyncReport,
  plan: SkillPlanArtifact,
  decision: SkillReplanDecision,
  source: SkillReplanSource,
): SkillReplanCheckpoint {
  if (!report.baseline_skill_plan) throw new Error('Resync report has no baseline Skill Plan to review');
  const currentSha = semanticSkillPlanHash(plan);
  assertDecisionMatchesBaseline(decision, report.baseline_skill_plan.sha256, currentSha);
  return {
    version: '1.0',
    task_id: report.task_id,
    decision,
    source,
    reviewed_at: new Date().toISOString(),
    resync: {
      detected_at: report.detected_at,
      commit_sha: report.current.commit_sha,
      worktree_sha256: report.current.worktree_sha256,
    },
    baseline_skill_plan_sha256: report.baseline_skill_plan.sha256,
    skill_plan: {
      sha256: currentSha,
      selected: plan.selected,
      resolved: plan.resolved ?? [],
    },
  };
}

export function verifySkillReplanCheckpoint(root: string, taskId: string, planPath: string): SkillReplanCheckpoint {
  const report = loadResyncReport(root, taskId);
  if (!report) throw new Error('Resync report missing; run resync.ts --prepare after detecting out-of-band changes');
  if (!report.requirements.skill_plan_review) throw new Error('Resync report does not require Skill Plan review');
  if (!report.baseline_skill_plan) throw new Error('Resync report is missing its baseline Skill Plan');
  const checkpoint = loadSkillReplanCheckpoint(root, taskId);
  if (!checkpoint) throw new Error('Skill Re-plan checkpoint missing');
  const plan = loadSkillPlan(planPath, taskId, true);
  const currentSha = semanticSkillPlanHash(plan);
  if (
    checkpoint.resync.detected_at !== report.detected_at ||
    checkpoint.resync.commit_sha !== report.current.commit_sha ||
    checkpoint.resync.worktree_sha256 !== report.current.worktree_sha256
  ) throw new Error('Skill Re-plan checkpoint is stale for the current Resync report');
  if (checkpoint.baseline_skill_plan_sha256 !== report.baseline_skill_plan.sha256) {
    throw new Error('Skill Re-plan checkpoint baseline does not match the current Resync report');
  }
  if (checkpoint.skill_plan.sha256 !== currentSha) throw new Error('Skill Re-plan checkpoint is stale for the current Skill Plan');
  if (
    checkpoint.skill_plan.selected.join('\0') !== plan.selected.join('\0') ||
    checkpoint.skill_plan.resolved.join('\0') !== (plan.resolved ?? []).join('\0')
  ) throw new Error('Skill Re-plan checkpoint Skill Plan contents do not match the current Skill Plan');
  assertDecisionMatchesBaseline(checkpoint.decision, report.baseline_skill_plan.sha256, currentSha);
  return checkpoint;
}
