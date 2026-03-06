# RIA Verification Policy

## Purpose

Define activation gate rules for advisor actors before investor private-data requests are allowed.

## State Machine

1. `draft`
2. `submitted`
3. `finra_verified`
4. `active`
5. `rejected`

## Gate Rules

1. `draft` and `submitted` cannot create investor-data access requests.
2. Only `finra_verified` can move to `active`.
3. `rejected` must resubmit and pass verification.
4. Outage or upstream verification failure keeps actor in non-active state.

## Break-Glass Policy

Manual override is allowed only when all conditions hold:

1. Explicit operator identity is recorded.
2. Reason code is required.
3. Review ticket reference is attached.
4. Action appears in audit logs.

## Verification Data Contract

1. `advisor_legal_name`
2. `firm_legal_name`
3. `crd_number`
4. `sec_registration_id`
5. `jurisdiction`
6. `verification_source`
7. `verification_checked_at`
8. `verification_expires_at`
9. `verification_status`

## Freshness Policy

1. Cache successful verification responses with TTL.
2. Re-verify on key identity edits (firm, CRD, jurisdiction).
3. Re-verify after TTL expiry.
