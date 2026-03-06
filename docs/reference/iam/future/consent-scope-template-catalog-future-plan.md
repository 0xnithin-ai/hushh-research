# Consent Scope Template Catalog (Future Plan)

## Status

`Future Plan` template baseline for UAT rollout.

## Purpose

Define reusable scope templates for investor-RIA consent requests while preserving dynamic scope flexibility and strict policy validation.

## Design Goals

1. Keep request UX simple with default templates.
2. Keep scope engine scalable using namespaced dynamic scopes.
3. Enforce least-privilege defaults.
4. Allow controlled custom scope expansion.

## Scope Namespace Baseline

1. Investor data scopes: `attr.investor.{domain}.{path}.*`
2. RIA data scopes: `attr.ria.{domain}.{path}.*` (future-light use)
3. Firm/ops scopes: `attr.firm.{domain}.{path}.*`

## V1 Template Set

| Template ID | Actor Direction | Example Scopes | Duration Defaults | Notes |
| --- | --- | --- | --- | --- |
| `ria_client_read_basic` | RIA -> Investor | `attr.investor.profile.*`, `attr.investor.risk.*`, `attr.investor.goals.*` | `30d` default | Baseline advisory context |
| `ria_client_portfolio_read` | RIA -> Investor | `attr.investor.portfolio.positions.*`, `attr.investor.portfolio.performance.*` | `30d` default | Portfolio review scope |
| `ria_client_tax_planning` | RIA -> Investor | `attr.investor.tax.*` | `90d` default | Higher-sensitivity scope |
| `investor_ria_disclosures` | Investor -> RIA | `attr.ria.disclosures.*`, `attr.ria.fees.*` | `7d` default | Advisor transparency |
| `investor_ria_recommendation_context` | Investor -> RIA | `attr.ria.recommendations.rationale.*` | `7d` default | Explainability request |

## Duration Policy

1. Presets: `24h`, `7d`, `30d`, `90d`.
2. Custom duration allowed with max cap `365d`.
3. No unlimited duration in V1.

## Request Validation Rules

1. Template must be compatible with actor direction.
2. Requested scopes must be subset of allowed namespace family.
3. Custom scopes require explicit review flags in audit metadata.
4. Reject any scope outside approved namespace policy.
5. Reject custom duration above `365d`.

## Audit Metadata (Target)

Target metadata fields added to consent request event:

1. `template_id`
2. `template_version`
3. `scope_count`
4. `duration_mode`: `preset | custom`
5. `duration_hours`
6. `requester_actor_type`
7. `subject_actor_type`

## Evolution Rules

1. Add template revisions with versioning; never mutate historical template semantics.
2. Keep backward compatibility for existing active consents.
3. Deprecate templates with explicit sunset date and replacement mapping.

## Non-Goals (V1)

1. No broad wildcard across all investor domains.
2. No firm-wide inherited grant in V1 without explicit firm policy design.
3. No permanent/no-expiry grants.

## Acceptance Criteria (Target)

1. Template-driven requests cover >=80% of standard advisory flows.
2. Policy validator blocks all out-of-family scopes.
3. Duration cap policy is enforced in all request entry points.
4. Audit records include actor and template metadata.
