# Marketplace Dual-Sided Plan (Future Plan)

## Status

`Future Plan` for UAT-only product validation.

## Goal

Enable two-sided discovery so investors and RIAs can find each other and start consent-driven data-sharing relationships.

## Entry Surface

1. New route: `/marketplace`
2. Tabs:
3. `Find RIAs`
4. `Find Investors`

## Investor Journey (Target)

1. Search/browse RIA profiles.
2. Open RIA public profile card.
3. Review verification status, firm metadata, disclosures, strategy summary.
4. Start consent flow or respond to inbound request.
5. Track relationship state in consent inbox/history.

## RIA Journey (Target)

1. Search/browse investor public profiles.
2. Select target investor profile.
3. Choose scope template and duration.
4. Submit consent request.
5. Monitor pending/approved/revoked statuses.
6. Access client workspace only after approval.

## Public vs Private Data Boundary

Public (discoverable without consent):

1. Display name and profile metadata allowed by policy.
2. Verification badge and firm attribution.
3. Non-sensitive strategy/disclosure summary.

Private (consent-gated only):

1. Investor world-model domains.
2. Portfolio/risk/tax details.
3. Advisor-client recommendation context and private history.

## Relationship Lifecycle

1. `discovered`
2. `request_pending`
3. `approved`
4. `revoked`
5. `expired`
6. `blocked` (policy/admin action)

## Ranking and Match Signals (Target)

1. Domain fit by requested scope family.
2. Risk profile compatibility.
3. Strategy style compatibility.
4. Verification recency and reliability indicators.

## Abuse and Safety Controls

1. Rate-limit outbound requests per actor/day.
2. Cooldown for repeated denied requests.
3. Blocklist support for abusive actor pairs.
4. Explicit request reason required for high-sensitivity templates.

## Observability (Target)

1. Marketplace view/open/search events.
2. Request creation/approval/denial/revocation funnel.
3. Match-to-approval conversion metrics.
4. Abuse-rate and denial-loop indicators.

## UAT Scope

1. Validate dual-sided UX and request conversion.
2. Validate scope-template and duration policy usability.
3. Validate end-to-end consent/audit consistency across both actor types.

## Acceptance Criteria (Target)

1. Both actor tabs operate with deterministic profile and request behavior.
2. Requests cannot bypass verification and consent policy checks.
3. Only approved relationships unlock private client workspace.
4. UAT metrics capture conversion and safety indicators for iteration.
