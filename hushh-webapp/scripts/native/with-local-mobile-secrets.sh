#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

LOCAL_SECRETS_ROOT="${LOCAL_SECRETS_ROOT:-${WEB_DIR}/.local-secrets/mobile-firebase}"
IOS_SOURCE="${IOS_SOURCE:-${LOCAL_SECRETS_ROOT}/GoogleService-Info.plist}"
ANDROID_SOURCE="${ANDROID_SOURCE:-${LOCAL_SECRETS_ROOT}/google-services.json}"
IOS_TARGET="${IOS_TARGET:-${WEB_DIR}/ios/App/App/GoogleService-Info.plist}"
ANDROID_TARGET="${ANDROID_TARGET:-${WEB_DIR}/android/app/google-services.json}"
REQUIRE_LOCAL_MOBILE_SECRETS="${REQUIRE_LOCAL_MOBILE_SECRETS:-0}"

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <command...>" >&2
  exit 1
fi

have_local_secrets=true
if [[ ! -f "${IOS_SOURCE}" || ! -f "${ANDROID_SOURCE}" ]]; then
  have_local_secrets=false
fi

if [[ "${have_local_secrets}" != "true" ]]; then
  if [[ "${REQUIRE_LOCAL_MOBILE_SECRETS}" = "1" ]]; then
    echo "Missing local mobile Firebase cache under ${LOCAL_SECRETS_ROOT}." >&2
    echo "Run: npm run bootstrap:mobile-firebase" >&2
    exit 1
  fi
  echo "Local mobile Firebase cache not found; using committed template files." >&2
  exec "$@"
fi

backup_dir="$(mktemp -d)"
cleanup() {
  if [[ -f "${backup_dir}/GoogleService-Info.plist" ]]; then
    cp "${backup_dir}/GoogleService-Info.plist" "${IOS_TARGET}"
  fi
  if [[ -f "${backup_dir}/google-services.json" ]]; then
    cp "${backup_dir}/google-services.json" "${ANDROID_TARGET}"
  fi
  rm -rf "${backup_dir}"
}
trap cleanup EXIT

cp "${IOS_TARGET}" "${backup_dir}/GoogleService-Info.plist"
cp "${ANDROID_TARGET}" "${backup_dir}/google-services.json"
cp "${IOS_SOURCE}" "${IOS_TARGET}"
cp "${ANDROID_SOURCE}" "${ANDROID_TARGET}"

echo "Applied local mobile Firebase cache for native build." >&2
"$@"
