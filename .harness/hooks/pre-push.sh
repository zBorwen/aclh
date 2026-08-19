#!/usr/bin/env bash
# Risk-aware task-completion gate.
# Installation:
#   cp .harness/hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

echo "[Harness] Starting risk-aware task-completion gates (pre-push)..."

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
  node .harness/scripts/delivery-gate.ts "$TASK_ID"
  if [ $? -ne 0 ]; then
    echo "[Harness] ERROR: Delivery gate failed for ${TASK_ID}. Push aborted."
    exit 1
  fi
done

echo "[Harness] All risk-aware delivery gates passed. Proceeding with push."
exit 0
