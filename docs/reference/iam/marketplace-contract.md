# Marketplace Contract

## Purpose

Define two-sided discovery and consent-initiation behavior between investors and RIAs.

## Entry Surface

1. Route: `/marketplace`
2. Tabs: `Find RIAs`, `Find Investors`

## Interaction Contract

1. Discovery is allowed using public profile metadata only.
2. Private data is inaccessible before consent approval.
3. Consent request flow is available from both sides.

## Public Profile Contract

Public cards may include:

1. display name
2. verification badge/status
3. firm attribution
4. strategy/disclosure summary

Public cards must not include private portfolio or sensitive personal fields.

## Relationship Lifecycle

1. `discovered`
2. `request_pending`
3. `approved`
4. `revoked`
5. `expired`
6. `blocked`

## Abuse Controls

1. Request rate limits per actor and time window.
2. Cooldown after repeated denials.
3. Blocklist support for actor pairs.
4. High-sensitivity requests require explicit reason.

## Observability Contract

Track metadata-only events for:

1. profile view/search
2. request create
3. request approve/deny/revoke
4. conversion and abuse-rate metrics
