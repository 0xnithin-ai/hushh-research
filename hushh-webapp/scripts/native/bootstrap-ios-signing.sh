#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS signing bootstrap is only supported on macOS." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOCAL_SIGNING_ROOT="${LOCAL_SIGNING_ROOT:-${WEB_DIR}/.local-secrets/ios-signing}"
PROJECT_ID="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-hushh-pda}}"
KEYCHAIN_NAME="${IOS_SIGNING_KEYCHAIN_NAME:-hushh-local-signing.keychain-db}"
KEYCHAIN_PATH="${HOME}/Library/Keychains/${KEYCHAIN_NAME}"
KEYCHAIN_PASSWORD_FILE="${LOCAL_SIGNING_ROOT}/keychain.password"
ENV_FILE="${LOCAL_SIGNING_ROOT}/signing.env"

APPLE_TEAM_ID_SECRET="${APPLE_TEAM_ID_SECRET:-APPLE_TEAM_ID}"
DEV_CERT_SECRET="${DEV_CERT_SECRET:-IOS_DEV_CERT_P12_B64}"
DEV_CERT_PASSWORD_SECRET="${DEV_CERT_PASSWORD_SECRET:-IOS_DEV_CERT_PASSWORD}"
DEV_PROFILE_SECRET="${DEV_PROFILE_SECRET:-IOS_DEV_PROFILE_B64}"
DIST_CERT_SECRET="${DIST_CERT_SECRET:-IOS_DIST_CERT_P12_B64}"
DIST_CERT_PASSWORD_SECRET="${DIST_CERT_PASSWORD_SECRET:-IOS_DIST_CERT_PASSWORD}"
DIST_PROFILE_SECRET="${DIST_PROFILE_SECRET:-IOS_APPSTORE_PROFILE_B64}"
ASC_KEY_SECRET="${ASC_KEY_SECRET:-APPSTORE_CONNECT_API_KEY_P8_B64}"
ASC_KEY_ID_SECRET="${ASC_KEY_ID_SECRET:-APPSTORE_CONNECT_KEY_ID}"
ASC_ISSUER_SECRET="${ASC_ISSUER_SECRET:-APPSTORE_CONNECT_ISSUER_ID}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

decode_b64_to_file() {
  local value="$1"
  local target="$2"
  if printf "" | base64 --decode >/dev/null 2>&1; then
    printf '%s' "${value}" | base64 --decode > "${target}"
    return
  fi
  printf '%s' "${value}" | base64 -D > "${target}"
}

secret_value() {
  gcloud secrets versions access latest --secret="$1" --project="${PROJECT_ID}"
}

install_profile() {
  local source_file="$1"
  local label="$2"
  local plist_file uuid profile_name destination

  plist_file="$(mktemp)"
  security cms -D -i "${source_file}" > "${plist_file}"
  uuid="$(/usr/libexec/PlistBuddy -c 'Print UUID' "${plist_file}")"
  profile_name="$(/usr/libexec/PlistBuddy -c 'Print Name' "${plist_file}")"
  destination="${HOME}/Library/MobileDevice/Provisioning Profiles/${uuid}.mobileprovision"
  mkdir -p "${HOME}/Library/MobileDevice/Provisioning Profiles"
  cp "${source_file}" "${destination}"
  rm -f "${plist_file}"
  printf '%s\t%s\t%s\n' "${label}" "${profile_name}" "${destination}" >> "${LOCAL_SIGNING_ROOT}/installed-profiles.tsv"
  printf '%s' "${profile_name}"
}

require_cmd gcloud
require_cmd security
require_cmd openssl

mkdir -p "${LOCAL_SIGNING_ROOT}"
: > "${LOCAL_SIGNING_ROOT}/installed-profiles.tsv"

if [[ ! -f "${KEYCHAIN_PASSWORD_FILE}" ]]; then
  openssl rand -hex 24 > "${KEYCHAIN_PASSWORD_FILE}"
  chmod 600 "${KEYCHAIN_PASSWORD_FILE}"
fi
KEYCHAIN_PASSWORD="$(cat "${KEYCHAIN_PASSWORD_FILE}")"

APPLE_TEAM_ID="$(secret_value "${APPLE_TEAM_ID_SECRET}")"
DEV_CERT_PASSWORD="$(secret_value "${DEV_CERT_PASSWORD_SECRET}")"
DIST_CERT_PASSWORD="$(secret_value "${DIST_CERT_PASSWORD_SECRET}")"
ASC_KEY_ID="$(secret_value "${ASC_KEY_ID_SECRET}")"
ASC_ISSUER_ID="$(secret_value "${ASC_ISSUER_SECRET}")"

decode_b64_to_file "$(secret_value "${DEV_CERT_SECRET}")" "${LOCAL_SIGNING_ROOT}/development.p12"
decode_b64_to_file "$(secret_value "${DEV_PROFILE_SECRET}")" "${LOCAL_SIGNING_ROOT}/development.mobileprovision"
decode_b64_to_file "$(secret_value "${DIST_CERT_SECRET}")" "${LOCAL_SIGNING_ROOT}/distribution.p12"
decode_b64_to_file "$(secret_value "${DIST_PROFILE_SECRET}")" "${LOCAL_SIGNING_ROOT}/appstore.mobileprovision"
decode_b64_to_file "$(secret_value "${ASC_KEY_SECRET}")" "${LOCAL_SIGNING_ROOT}/AuthKey_${ASC_KEY_ID}.p8"

if [[ ! -f "${KEYCHAIN_PATH}" ]]; then
  security create-keychain -p "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_NAME}"
fi

security unlock-keychain -p "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}"
security set-keychain-settings -lut 21600 "${KEYCHAIN_PATH}"
security list-keychains -d user -s "${KEYCHAIN_PATH}" $(security list-keychains -d user | tr -d '"')
security import "${LOCAL_SIGNING_ROOT}/development.p12" -k "${KEYCHAIN_PATH}" -P "${DEV_CERT_PASSWORD}" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
security import "${LOCAL_SIGNING_ROOT}/distribution.p12" -k "${KEYCHAIN_PATH}" -P "${DIST_CERT_PASSWORD}" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
security set-key-partition-list -S apple-tool:,apple: -s -k "${KEYCHAIN_PASSWORD}" "${KEYCHAIN_PATH}" >/dev/null

DEV_PROFILE_NAME="$(install_profile "${LOCAL_SIGNING_ROOT}/development.mobileprovision" development)"
DIST_PROFILE_NAME="$(install_profile "${LOCAL_SIGNING_ROOT}/appstore.mobileprovision" distribution)"

cat > "${LOCAL_SIGNING_ROOT}/debug-signing.xcconfig" <<EOF
DEVELOPMENT_TEAM = ${APPLE_TEAM_ID}
CODE_SIGN_STYLE = Manual
CODE_SIGN_IDENTITY = Apple Development
PROVISIONING_PROFILE_SPECIFIER = ${DEV_PROFILE_NAME}
EOF

cat > "${LOCAL_SIGNING_ROOT}/release-signing.xcconfig" <<EOF
DEVELOPMENT_TEAM = ${APPLE_TEAM_ID}
CODE_SIGN_STYLE = Manual
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = ${DIST_PROFILE_NAME}
EOF

cat > "${ENV_FILE}" <<EOF
export APPLE_TEAM_ID='${APPLE_TEAM_ID}'
export IOS_SIGNING_KEYCHAIN_PATH='${KEYCHAIN_PATH}'
export IOS_SIGNING_KEYCHAIN_PASSWORD='${KEYCHAIN_PASSWORD}'
export APPSTORE_CONNECT_API_KEY_PATH='${LOCAL_SIGNING_ROOT}/AuthKey_${ASC_KEY_ID}.p8'
export APPSTORE_CONNECT_KEY_ID='${ASC_KEY_ID}'
export APPSTORE_CONNECT_ISSUER_ID='${ASC_ISSUER_ID}'
EOF
chmod 600 "${ENV_FILE}"

echo "Local iOS signing bootstrap completed."
echo "  keychain: ${KEYCHAIN_PATH}"
echo "  env file: ${ENV_FILE}"
echo "  debug xcconfig: ${LOCAL_SIGNING_ROOT}/debug-signing.xcconfig"
echo "  release xcconfig: ${LOCAL_SIGNING_ROOT}/release-signing.xcconfig"
