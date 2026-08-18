#!/usr/bin/env bash
# Evidence + adversarial self-review gate for task completion.
#
# Runs before `git push`. For every task under docs/wip, the hook first verifies
# that required machine-gate evidence exists, then runs adversarial self-review.
#
# Installation:
#   cp .harness/hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

echo "[Harness] Starting evidence + self-review gate (pre-push)..."

if ! command -v node &> /dev/null; then
  echo "[Harness] ERROR: Node.js is not installed."
  exit 1
fi

TASK_STATES=(docs/wip/*/.state.yaml)
if [ ! -e "${TASK_STATES[0]}" ]; then
  echo "[Harness] No task state files found under docs/wip/. Skipping task gates."
  exit 0
fi

for STATE_FILE in "${TASK_STATES[@]}"; do
  TASK_ID=$(basename "$(dirname "$STATE_FILE")")
  echo "[Harness] Verifying machine evidence for ${TASK_ID}..."
  node .harness/scripts/evidence.ts "$TASK_ID" --verify
  if [ $? -ne 0 ]; then
    echo "[Harness] ERROR: Required evidence is missing or failing for ${TASK_ID}. Push aborted."
    echo "[Harness] Record gates first:"
    echo "[Harness]   npm run evidence -- ${TASK_ID} --gate check"
    echo "[Harness]   npm run evidence -- ${TASK_ID} --gate typecheck"
    echo "[Harness]   npm run evidence -- ${TASK_ID} --gate test"
    exit 1
  fi
done

echo "[Harness] Running adversarial self-review on active tasks..."
node .harness/scripts/self-review.ts
if [ $? -ne 0 ]; then
  echo "[Harness] ERROR: Adversarial self-review found MISS/WARN items. Push aborted."
  exit 1
fi

echo "[Harness] Evidence and self-review passed. Proceeding with push."
exit 0
