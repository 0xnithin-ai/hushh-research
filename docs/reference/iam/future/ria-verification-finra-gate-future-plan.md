# RIA Verification FINRA Gate (Future Plan)

## Status

`Future Plan` for UAT onboarding and governance.

## Goal

Require RIA verification before advisor-side private data requests are allowed.

## Decision

V1 uses a FINRA-required verification gate for RIA activation.

## RIA Verification State Machine

1. `draft`
2. `submitted`
3. `finra_verified`
4. `active`
5. `rejected`

## Enforcement Rules

1. Users in `draft` or `submitted` cannot create investor data access requests.
2. Only `finra_verified` users can transition to `active`.
3. `rejected` users must resubmit with corrected details.
4. Break-glass manual override is permitted only with explicit audited operator action.

## Data Fields for Verification (Target)

1. `advisor_legal_name`
2. `firm_legal_name`
3. `crd_number`
4. `sec_registration_id` (if applicable)
5. `jurisdiction`
6. `evidence_urls` (if manual support docs required)
7. `verification_source`
8. `verification_checked_at`
9. `verification_expires_at`
10. `verification_status`

## FINRA Dependency Handling

1. If verification API/dependency is unavailable, keep applicant in `submitted`.
2. Do not bypass directly to `active`.
3. Retry with backoff policy and record all attempts.
4. Surface clear status in UI: `pending verification`.

## Caching and Freshness Policy

1. Cache positive verification results.
2. Define freshness TTL for recertification checks.
3. Trigger re-verification on key profile edits (firm, CRD, jurisdiction).

## Security and Compliance Controls

1. Verification state transitions must be auditable.
2. Operator overrides require reason code and actor identity.
3. Verification metadata should be separated from investor consent payloads.
4. No sensitive credentials stored in client-side persistent storage.

## External Dependency Notes

1. FINRA API usage and production scale may require specific plan/terms.
2. UAT should tolerate dependency delays/failures without granting access prematurely.
3. This plan assumes legal/compliance review before production enablement.

## Acceptance Criteria (Target)

1. Unverified RIA cannot request investor private scopes.
2. Verified RIA can request access with policy-compliant scope/duration.
3. Verification failures and dependency outages produce deterministic pending state.
4. Manual override path is logged and reviewable end-to-end.

## References

1. FINRA Developer Docs: https://developer.finra.org/docs
2. FINRA Plans and Pricing: https://developer.finra.org/plans-and-pricing
