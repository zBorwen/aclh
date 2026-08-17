#!/usr/bin/env bash
# Adversarial self-review gate for task completion.
#
# Runs before `git push`. If any task directory under docs/wip has an active
# state (.state.yaml), the self-review hook runs and blocks the push until it
# passes (no MISS items).
#
# Installation:
#   cp .harness/hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

echo "[Harness] Starting adversarial self-review gate (pre-push)..."

if ! command -v node &> /dev/null; then
  echo "[Harness] ERROR: Node.js is not installed."
  exit 1
fi

ACTIVE_TASKS=$(ls docs/wip/*/.state.yaml 2>/dev/null | wc -l | tr -d ' ')
if [ "$ACTIVE_TASKS" = "0" ]; then
  echo "[Harness] No task state files found under docs/wip/. Skipping self-review."
  exit 0
fi

echo "[Harness] Running adversarial self-review on active tasks..."
node .harness/scripts/self-review.ts
if [ $? -ne 0 ]; then
  echo "[Harness] ERROR: Adversarial self-review found MISS items. Push aborted."
  echo "[Harness] Fix the MISS items or record them as tracked gaps, then re-run:"
  echo "[Harness]   node .harness/scripts/self-review.ts <TASK_ID>"
  exit 1
fi

echo "[Harness] Self-review passed. Proceeding with push."
exit 0