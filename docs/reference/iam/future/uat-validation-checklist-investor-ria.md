# UAT Validation Checklist: Investor + RIA

## Status

`Future Plan` UAT gate checklist. This checklist becomes release-governance input once implementation exists.

## Objective

Validate dual-interface Investor/RIA behavior in UAT without changing production behavior.

## Pre-Validation Guardrails

1. Confirm environment is UAT-only.
2. Confirm production services and databases are not targeted.
3. Confirm deployment is routed to UAT project/branch only (`deploy_uat` lane).
4. Confirm route and API contracts include any new UAT surfaces.

## Functional Validation

1. Persona switching:
2. Same account can switch Investor <-> RIA.
3. Last active persona is restored on next login.
4. Route trees:
5. Investor routes continue to work unchanged.
6. `/ria/*` routes load and enforce role/verification gates.
7. Marketplace:
8. `/marketplace` shows `Find RIAs` and `Find Investors`.
9. Public profile cards render expected metadata only.

## Consent and IAM Validation

1. RIA in non-verified state cannot create private-scope requests.
2. Verified RIA can create requests using templates and custom duration.
3. Duration presets work: `24h`, `7d`, `30d`, `90d`.
4. Custom duration above `365d` is rejected.
5. Approve/deny/revoke lifecycle updates both actor views.
6. Scoped workspace shows only consented domains/paths.

## Verification Gate Validation

1. RIA onboarding transitions:
2. `draft -> submitted -> finra_verified -> active` (or `rejected`)
3. Dependency outage keeps requesters in `submitted` and blocks access.
4. Manual override, if used, is fully auditable.

## Security/Privacy Validation

1. No unauthorized scope access across actor boundaries.
2. No private payload leakage in public marketplace views.
3. Audit trail contains actor and scope metadata for all lifecycle transitions.
4. Sensitive values are not emitted in analytics payloads.

## Observability Validation

1. Funnel metrics available for:
2. profile view -> request -> approve/deny/revoke
3. RIA onboarding submit -> verified -> active
4. Error metrics include scope validation and verification failures.
5. Request latency and failure classes are visible in UAT dashboards.

## Regression Validation

1. Existing investor core flows still pass in UAT:
2. `/`, `/login`, `/kai`, `/kai/dashboard`, `/kai/analysis`, `/consents`, `/profile`
3. No behavior regression on consent page for existing investor-only use.

## Exit Criteria for UAT Completion

1. All required checklist sections pass.
2. No P0/P1 consent or access-control defects remain open.
3. KPI baseline is established for onboarding, consent conversion, and reliability.
4. Production promotion decision remains separate and explicit.
