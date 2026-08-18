#!/usr/bin/env bash
# Evidence + adversarial self-review + independent-review gate for task completion.
# Installation:
#   cp .harness/hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

echo "[Harness] Starting task-completion gates (pre-push)..."

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
  node .harness/scripts/evidence.ts "$TASK_ID" --verify || exit 1

  echo "[Harness] Running builder adversarial self-review for ${TASK_ID}..."
  node .harness/scripts/self-review.ts "$TASK_ID" || exit 1

  echo "[Harness] Verifying independent review for ${TASK_ID}..."
  node .harness/scripts/independent-review.ts "$TASK_ID" --verify
  if [ $? -ne 0 ]; then
    echo "[Harness] ERROR: Independent review is missing, rejected, or stale. Push aborted."
    echo "[Harness] Prepare the reviewer packet with:"
    echo "[Harness]   node .harness/scripts/independent-review.ts ${TASK_ID} --prepare"
    echo "[Harness] Then review it in a fresh Codex context (or by a human) and record independent-review.json."
    exit 1
  fi
done

echo "[Harness] Evidence, self-review, and independent review passed. Proceeding with push."
exit 0
