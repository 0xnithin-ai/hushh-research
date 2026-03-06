# UAT-First Investor + RIA Dual-Interface Plan

## Status

`Future Plan` (pre-implementation). This is a planning baseline for UAT execution only.

## Summary

Build a dual-actor product baseline like rider/driver apps:

1. `Investor` and `RIA` have separate route trees and tailored UX.
2. One account can hold both personas and defaults to the last active persona.
3. Consent remains the IAM core mechanism for all private data exchange.
4. Rollout is UAT-first and production-safe by default.

## Locked Decisions

1. Separate actor route trees with discoverable entry points.
2. Single account supports dual personas (`investor | ria`) with last-view default.
3. Consent duration supports presets and custom duration.
4. Marketplace is two-sided: investors discover RIAs, RIAs discover investors.
5. IAM depth includes advisor and firm context.
6. Data access is in-app scoped views in V1 (no default exports).
7. RIA verification is FINRA-gated.
8. UAT is the only rollout environment for this phase.

## Product Baseline (V1)

1. Keep existing investor Kai flows as current baseline.
2. Add RIA route family under `/ria/*`:
3. `/ria/onboarding`
4. `/ria/clients`
5. `/ria/requests`
6. `/ria/workspace/:clientId`
7. Add discoverable marketplace route:
8. `/marketplace` with `Find RIAs` and `Find Investors`.
9. Add persona switcher visible after login.
10. Persist `last_active_persona` and route to that view on next sign-in.

## IAM + Consent Model

Use existing consent audit/token engine and extend request semantics with actor context.

Required request metadata (target):

1. `requester_actor_type`: `ria | investor`
2. `subject_actor_type`: `investor | ria`
3. `requester_entity_id`: advisor profile ID (and optional firm context)
4. `duration_policy`: preset or custom with cap enforcement
5. `scope_template_id`: optional template selection

Duration policy defaults:

1. Presets: `24h`, `7d`, `30d`, `90d`
2. Custom: allowed up to max `365d`
3. Reject custom duration above cap

Validation policy in consent request creation:

1. Reject invalid scope combinations.
2. Reject duration above cap.
3. Reject requester actions if RIA is not verified.

## Scoping Strategy for Scale

Retain dynamic scope style to avoid disruptive rewrite and introduce actor namespaces:

1. Investor data to RIA: `attr.investor.{domain}.{path}.*`
2. RIA data to Investor (future-light): `attr.ria.{domain}.{path}.*`
3. Firm/ops scopes: `attr.firm.{domain}.{path}.*`

Guardrail:

1. Broad emergency/admin scopes remain out of V1.

## FINRA Verification Gate (V1)

RIA onboarding state machine:

1. `draft`
2. `submitted`
3. `finra_verified`
4. `active` or `rejected`

Rules:

1. No consent request creation until `finra_verified`.
2. If FINRA dependency is unavailable, keep state at `submitted`.
3. Allow break-glass manual override only with explicit audit trace.

## Investor <-> RIA Information Exchange Examples

Investor requesting advisor-side information (explicit consent):

1. Advisor disclosures and fee schedule.
2. Model portfolio rationale behind a recommendation.
3. Advisor meeting/action summary history for the account.
4. Conflict-of-interest declarations and updates.

## Route and Interface Contracts (Target)

1. New route family: `/ria/*`, `/marketplace`.
2. Persona contract enum: `investor | ria`.
3. Relationship lifecycle: `pending`, `approved`, `revoked`, `expired`.
4. Verification status contract for RIA profile.

## UAT-Only Rollout Guardrails

1. Production routes and behavior remain unchanged.
2. New RIA features are enabled in UAT only.
3. UAT rollout is environment-owned (`ENVIRONMENT` + `NEXT_PUBLIC_APP_ENV`) and isolated by branch/project.
4. Promote only after UAT checklist passes.

## KPI Framework

| KPI Area | Metric | Target Direction |
| --- | --- | --- |
| Onboarding | RIA submit-to-verified rate | Up |
| Onboarding | Median verification lead time | Down |
| Marketplace | Profile view to consent request rate | Up |
| Consent | Request approve rate | Up |
| Consent | Median grant duration selected | Stable by policy |
| Consent | Revoke rate within 7 days | Down |
| Activation | Verified RIA with >=1 approved investor | Up |
| Usage | Weekly active RIA workspaces | Up |
| Reliability | Consent request p95 latency | Down |
| Security | Unauthorized scope access attempts | Zero trend |

## Important Target API / Interface Changes

1. Persona enum: `investor | ria`.
2. Consent request payload extension:
3. `requester_actor_type`
4. `subject_actor_type`
5. `requester_entity_id`
6. `duration_policy`
7. `scope_template_id`
8. New RIA verification status and advisor-investor relationship contracts.

## Test Scenarios (Target)

1. Persona switching persists and restores last active view.
2. Unverified RIA cannot request private data access.
3. Verified RIA can submit valid requests.
4. Duration cap blocks custom values above `365d`.
5. Consent lifecycle updates both actor views and audit trail.
6. RIA workspace returns only scoped data.
7. UAT isolation confirms no production data mutation.

## Assumptions and Defaults

1. This document is a future plan, not implementation evidence.
2. UAT is the only environment for this phase.
3. Production remains unchanged.
4. Existing consent architecture is reused and extended.
5. FINRA gate is mandatory for RIA activation in V1.
