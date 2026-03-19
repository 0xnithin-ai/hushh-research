#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [ "${SKIP_SECRET_SCAN:-0}" = "1" ]; then
  echo "Skipping secret scan because SKIP_SECRET_SCAN=1"
  exit 0
fi

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is required for CI parity. Install it or set SKIP_SECRET_SCAN=1 for local-only runs."
  exit 1
fi

if [ -n "${GITLEAKS_LOG_OPTS:-}" ]; then
  LOG_OPTS="${GITLEAKS_LOG_OPTS}"
else
  DEFAULT_BRANCH="${GITLEAKS_DEFAULT_BRANCH:-}"
  if [ -z "$DEFAULT_BRANCH" ]; then
    DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
  fi

  if [ -n "$DEFAULT_BRANCH" ] && git rev-parse "origin/$DEFAULT_BRANCH" >/dev/null 2>&1; then
    MERGE_BASE="$(git merge-base "origin/$DEFAULT_BRANCH" HEAD)"
    LOG_OPTS="--ancestry-path ${MERGE_BASE}..HEAD"
  else
    LOG_OPTS="HEAD"
  fi
fi

echo "Running gitleaks with log opts: ${LOG_OPTS}"
gitleaks git --redact --no-banner --exit-code 1 --log-opts="${LOG_OPTS}"
