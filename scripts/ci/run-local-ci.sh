#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "== CI Parity (Local) =="
echo "Running fundamental blocking checks used by GitHub Actions."

scripts/ci/secret-scan.sh
scripts/ci/web-check.sh
scripts/ci/protocol-check.sh
scripts/ci/integration-check.sh

if [ "${INCLUDE_ADVISORY_CHECKS:-0}" = "1" ]; then
  echo "Including advisory checks (docs parity + subtree sync)."
  scripts/ci/docs-parity-check.sh
  scripts/ci/subtree-sync-check.sh
else
  echo "Skipping advisory checks. Set INCLUDE_ADVISORY_CHECKS=1 to include them."
fi

echo "✅ Local CI parity checks passed."
