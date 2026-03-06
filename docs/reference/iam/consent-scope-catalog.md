# Consent Scope Catalog

## Purpose

Define canonical scope families and template policy for Investor + RIA consent requests.

## Namespace Policy

1. Investor data scopes: `attr.investor.{domain}.{path}.*`
2. RIA data scopes: `attr.ria.{domain}.{path}.*`
3. Firm policy scopes: `attr.firm.{domain}.{path}.*`

No broad cross-domain wildcard scopes are allowed by default.

## Template Catalog (V1)

| Template ID | Actor Direction | Scope Set | Default Duration |
| --- | --- | --- | --- |
| `ria_client_read_basic` | RIA -> Investor | `attr.investor.profile.*`, `attr.investor.risk.*`, `attr.investor.goals.*` | `30d` |
| `ria_client_portfolio_read` | RIA -> Investor | `attr.investor.portfolio.positions.*`, `attr.investor.portfolio.performance.*` | `30d` |
| `ria_client_tax_planning` | RIA -> Investor | `attr.investor.tax.*` | `90d` |
| `investor_ria_disclosures` | Investor -> RIA | `attr.ria.disclosures.*`, `attr.ria.fees.*` | `7d` |
| `investor_ria_recommendation_context` | Investor -> RIA | `attr.ria.recommendations.rationale.*` | `7d` |

## Duration Policy

1. Presets: `24h`, `7d`, `30d`, `90d`
2. Custom duration allowed up to `365d`
3. No no-expiry grants

## Validation Rules

1. Actor direction must match template policy.
2. Requested scopes must belong to allowed namespace family.
3. Custom scope expansion requires audit metadata flag.
4. Requests above duration cap are rejected.
5. Unverified `ria` requester is rejected.

## Audit Metadata Contract

Consent request events should include:

1. `template_id`
2. `template_version`
3. `scope_count`
4. `duration_mode`
5. `duration_hours`
6. `requester_actor_type`
7. `subject_actor_type`
8. `requester_entity_id`

## Compatibility Rules

1. Keep compatibility with dynamic scope resolver conventions.
2. Never mutate historical template semantics in place.
3. Introduce new template versions with explicit migration note.
