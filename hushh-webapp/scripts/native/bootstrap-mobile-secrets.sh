#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PROJECT_ID="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-hushh-pda}}"
IOS_SECRET_NAME="${IOS_SECRET_NAME:-IOS_GOOGLESERVICE_INFO_PLIST_B64}"
ANDROID_SECRET_NAME="${ANDROID_SECRET_NAME:-ANDROID_GOOGLE_SERVICES_JSON_B64}"
LOCAL_SECRETS_ROOT="${LOCAL_SECRETS_ROOT:-${WEB_DIR}/.local-secrets/mobile-firebase}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd gcloud

mkdir -p "${LOCAL_SECRETS_ROOT}"

IOS_GOOGLESERVICE_INFO_PLIST_B64="$(gcloud secrets versions access latest --secret="${IOS_SECRET_NAME}" --project="${PROJECT_ID}")"
ANDROID_GOOGLE_SERVICES_JSON_B64="$(gcloud secrets versions access latest --secret="${ANDROID_SECRET_NAME}" --project="${PROJECT_ID}")"

IOS_TARGET="${LOCAL_SECRETS_ROOT}/GoogleService-Info.plist" \
ANDROID_TARGET="${LOCAL_SECRETS_ROOT}/google-services.json" \
IOS_GOOGLESERVICE_INFO_PLIST_B64="${IOS_GOOGLESERVICE_INFO_PLIST_B64}" \
ANDROID_GOOGLE_SERVICES_JSON_B64="${ANDROID_GOOGLE_SERVICES_JSON_B64}" \
bash "${WEB_DIR}/scripts/inject-mobile-firebase-artifacts.sh"

echo "Local mobile Firebase cache is ready under ${LOCAL_SECRETS_ROOT}."
echo "Tracked template files were not modified."
