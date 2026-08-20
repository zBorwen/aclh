import fs from 'node:fs';
import { gitLocalAclhPath } from './managed-snapshot-runtime.ts';

export interface ResyncReport {
  version: '1.0';
  task_id: string;
  status: 'changed';
  detected_at: string;
  managed: {
    recorded_at: string;
    commit_sha: string;
    worktree_sha256: string;
  };
  current: {
    commit_sha: string;
    worktree_sha256: string;
  };
  baseline_skill_plan: {
    sha256: string;
    selected: string[];
    resolved: string[];
  } | null;
  changes: {
    current_task_change_set: string[];
    committed_since_checkpoint: string[];
    current_worktree_files: string[];
  };
  requirements: {
    preserve_classification: true;
    skill_plan_review: boolean;
    context_scope_refresh: boolean;
    context_refresh: boolean;
    evidence_refresh: boolean;
    self_review_refresh: boolean;
    independent_review_refresh: boolean;
  };
}

export function resyncReportPath(root: string, taskId: string): string {
  return gitLocalAclhPath(root, `resync/${taskId}.json`);
}

export function loadResyncReport(root: string, taskId: string): ResyncReport | null {
  const file = resyncReportPath(root, taskId);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ResyncReport>;
  if (
    parsed.version !== '1.0' ||
    parsed.task_id !== taskId ||
    parsed.status !== 'changed' ||
    typeof parsed.detected_at !== 'string' ||
    !parsed.managed ||
    !parsed.current ||
    parsed.baseline_skill_plan === undefined ||
    !parsed.changes ||
    !parsed.requirements ||
    typeof parsed.requirements.context_scope_refresh !== 'boolean'
  ) throw new Error('invalid resync report schema');
  if (parsed.baseline_skill_plan !== null) {
    const baseline = parsed.baseline_skill_plan;
    if (
      typeof baseline !== 'object' ||
      typeof baseline.sha256 !== 'string' ||
      !Array.isArray(baseline.selected) || baseline.selected.some(item => typeof item !== 'string') ||
      !Array.isArray(baseline.resolved) || baseline.resolved.some(item => typeof item !== 'string')
    ) throw new Error('invalid resync baseline Skill Plan');
  }
  return parsed as ResyncReport;
}
