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
  changes: {
    current_task_change_set: string[];
    committed_since_checkpoint: string[];
    current_worktree_files: string[];
  };
  requirements: {
    preserve_classification: true;
    skill_plan_review: boolean;
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
    !parsed.changes ||
    !parsed.requirements
  ) throw new Error('invalid resync report schema');
  return parsed as ResyncReport;
}
