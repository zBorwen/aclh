#!/usr/bin/env bash
# Installation:
#   Option A: cp .harness/hooks/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#   Option B (husky): npx husky add .husky/pre-commit '.harness/hooks/pre-commit.sh'
#   Option C (lefthook): add to lefthook.yml

echo "[Harness] Starting pre-commit checks / 开始执行 pre-commit 检查..."

if ! command -v node &> /dev/null; then
  echo "[Harness] ERROR: Node.js is not installed. Please install Node.js to run harness checks."
  echo "[Harness] 错误：未安装 Node.js。请安装 Node.js 以运行 harness 检查。"
  exit 1
fi

echo "[Harness] Running Harness Checks / 运行 Harness 配置检查..."
node .harness/scripts/check.ts
if [ $? -ne 0 ]; then
  echo "[Harness] ERROR: Harness checks failed. Commit aborted."
  echo "[Harness] 错误：Harness 检查失败。终止提交。"
  exit 1
fi

PROFILE_FILE=".harness/project/profile.yaml"
if [ -f "$PROFILE_FILE" ]; then
  LINT_CMD=$(grep '^[[:space:]]*lint:' "$PROFILE_FILE" | sed -e 's/^[[:space:]]*lint:[[:space:]]*//' -e 's/[[:space:]]*#.*//' -e 's/["'\'' ]*$//' -e 's/^["'\'' ]*//')
  TEST_CMD=$(grep '^[[:space:]]*test:' "$PROFILE_FILE" | sed -e 's/^[[:space:]]*test:[[:space:]]*//' -e 's/[[:space:]]*#.*//' -e 's/["'\'' ]*$//' -e 's/^["'\'' ]*//')

  if [ -n "$LINT_CMD" ]; then
    echo "[Harness] Running lint command / 运行 lint 命令: $LINT_CMD"
    eval "$LINT_CMD"
    if [ $? -ne 0 ]; then
      echo "[Harness] ERROR: Lint checks failed. Commit aborted."
      echo "[Harness] 错误：代码规范检查失败。终止提交。"
      exit 1
    fi
  fi

  if [ -n "$TEST_CMD" ]; then
    echo "[Harness] Running test command / 运行 test 命令: $TEST_CMD"
    eval "$TEST_CMD"
    if [ $? -ne 0 ]; then
      echo "[Harness] ERROR: Tests failed. Commit aborted."
      echo "[Harness] 错误：测试失败。终止提交。"
      exit 1
    fi
  fi
fi

echo "[Harness] Pre-commit checks passed! / 检查通过！"
exit 0
