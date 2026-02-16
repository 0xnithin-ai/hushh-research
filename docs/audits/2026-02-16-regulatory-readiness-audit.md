# Regulatory Readiness Audit Report

Date: 2026-02-16  
Repository: `hushh-research`  
Audit Type: Full codebase audit with second-pass rescan  
Primary Context: Investor domain with high regulatory and trust requirements

## Index
1. Executive Summary
2. Scope and Method
3. System Profile
4. File Organization Level
5. Control-Domain Scorecard
6. Findings Register
7. Verification Results (Second Pass)
8. Minimum Baseline for Regulated Deployment
9. Prioritized Remediation Plan
10. Leadership Decision Gate
11. TL;DR

## 1. Executive Summary
Current state is not ready for a highly regulated production environment.

Strengths:
- Strong architecture intent (consent-first model, tokenized access model, BYOK direction).
- Good automated test footprint (`183` backend tests passed, `30` frontend tests passed).
- CI structure exists and core build/test pipeline is functional.

Blocking risks:
- Reviewer credentials can be returned from a public endpoint.
- Consent event stream endpoints are unauthenticated.
- A user lookup endpoint allows email-based account enumeration.
- Several production routes/features are placeholders or partially implemented.

Readiness verdict:
- Engineering maturity: **moderate**
- Regulatory readiness: **insufficient**
- Deployment recommendation: **No-go** until critical findings are remediated

## 2. Scope and Method
This report includes a second-pass rescan completed on `Mon Feb 16 00:27:52 PST 2026`.

Audit method:
- Architecture and route-level code review (frontend, backend, mobile bridge).
- Security and compliance pattern scan (authN/authZ, secrets, data exposure).
- CI-quality gate reruns.
- Static scans and dependency checks.

Rescan commands (highlights):
- `npm run verify:routes` (failed)
- `python3 -m pytest tests/quality -q` (passed)
- `python3 -m pytest tests/ -q` (passed)
- `npm run typecheck && npm run lint && npm test` (passed with warnings)
- `python3 -m bandit -r consent-protocol/api consent-protocol/hushh_mcp -q` (issues reported)
- `npm audit --audit-level=high` (moderate vulnerabilities remain)

## 3. System Profile
Monorepo with clear domain split:
- Frontend and mobile shell: `hushh-webapp` (Next.js + Capacitor)
- Backend protocol and APIs: `consent-protocol` (FastAPI + Python)
- Deployment configs: `deploy`
- Documentation and audits: `docs`

Quantitative profile:
- Total tracked files: `769`
- Backend tests: `83` files, `183` tests executed
- Frontend tests: `13` files, `30` tests executed
- Next API route files: `40`
- FastAPI route modules: `28`
- Documentation markdown files: `31` (in `docs`, `consent-protocol/docs`, `hushh-webapp/docs`)

## 4. File Organization Level
File organization maturity: **Level 3 of 5 (Structured, not controlled)**

Level model used:
- Level 1: Ad-hoc
- Level 2: Basic grouping
- Level 3: Structured by domain/module
- Level 4: Controlled with strict contracts and ownership
- Level 5: Regulated-grade traceability and enforcement

Why Level 3:
- Positive:
  - Clear top-level bounded contexts (`hushh-webapp`, `consent-protocol`, `deploy`, `docs`).
  - Meaningful service and route separation in backend.
  - Broad docs coverage and explicit audit docs folder.
- Gaps:
  - Contract enforcement drift exists (`verify:routes` currently fails).
  - Duplicate implementations for same concern exist (`hushh-webapp/hooks/use-mobile.ts` and `hushh-webapp/hooks/use-mobile.tsx`).
  - Deprecated and placeholder paths remain in active code surface.

## 5. Control-Domain Scorecard
| Domain | Score (0-5) | Status |
|---|---:|---|
| Access Control | 2.0 | High risk |
| Data Protection and Secrets | 2.0 | High risk |
| Consent and Auditability | 2.5 | Moderate-high risk |
| API Integrity and Contract Governance | 2.5 | Moderate-high risk |
| SDLC and Test Discipline | 3.5 | Moderate |
| Observability and Incident Readiness | 2.5 | Moderate-high risk |
| Production Hardening | 2.0 | High risk |
| Overall Regulated Readiness | **2.4** | **Insufficient** |

## 6. Findings Register

### Critical Findings
| ID | Finding | Business Impact | Evidence |
|---|---|---|---|
| C-01 | Reviewer credentials exposed through public config route | Direct credential disclosure risk | `consent-protocol/api/routes/health.py:25`, `consent-protocol/api/routes/health.py:33`, `consent-protocol/api/routes/health.py:34`, `hushh-webapp/app/page.tsx:179`, `hushh-webapp/app/page.tsx:283` |
| C-02 | Consent SSE endpoints are unauthenticated | Unauthorized monitoring of consent activity | `consent-protocol/api/routes/sse.py:115`, `consent-protocol/api/routes/sse.py:147`, `hushh-webapp/app/api/consent/events/[userId]/route.ts:8` |
| C-03 | Public user lookup endpoint allows account enumeration | Privacy breach and targeted abuse risk | `consent-protocol/api/routes/session.py:216` |
| C-04 | Sensitive API keys are committed and injected in build configs | Secret hygiene and governance weakness in regulated posture | `deploy/frontend.cloudbuild.yaml:16`, `hushh-webapp/android/app/google-services.json:31`, `hushh-webapp/ios/App/App/GoogleService-Info.plist:12` |

### High Findings
| ID | Finding | Business Impact | Evidence |
|---|---|---|---|
| H-01 | Default auth path does not enforce DB-backed revocation check | Cross-instance revocations may lag in enforcement | `consent-protocol/api/middleware.py:132`, `consent-protocol/hushh_mcp/consent/token.py:167` |
| H-02 | Active consent token state is keyed by `scope` only | Token lifecycle collisions across apps/agents sharing a scope | `consent-protocol/hushh_mcp/services/consent_db.py:185` |
| H-03 | Identity routes are wired but return migration placeholders (`503`) | Broken investor identity journey in production flows | `consent-protocol/api/routes/identity.py:19`, `consent-protocol/api/routes/identity.py:208`, `hushh-webapp/lib/services/identity-service.ts:140` |
| H-04 | Sync endpoints are placeholders but return success | Data consistency and reconciliation integrity risk | `consent-protocol/api/routes/sync.py:56`, `consent-protocol/api/routes/sync.py:78`, `consent-protocol/api/routes/sync.py:100` |
| H-05 | Route contract verification currently fails | CI integrity and API governance control gap | `hushh-webapp/scripts/verify-route-contracts.cjs:148`, `hushh-webapp/route-contracts.json:3`, `hushh-webapp/app/api/app-config/review-mode/route.ts:1` |
| H-06 | Extensive logging in auth/consent/vault paths | Potential leakage of user context and operationally sensitive metadata | `hushh-webapp/app/page.tsx:170`, `hushh-webapp/lib/services/account-service.ts:21`, `consent-protocol/api/routes/session.py:244`, `consent-protocol/api/routes/consent.py:528` |

### Medium Findings
| ID | Finding | Business Impact | Evidence |
|---|---|---|---|
| M-01 | Async route handlers rely heavily on sync DB execution | Potential throughput bottlenecks and event-loop contention | `consent-protocol/hushh_mcp/services/world_model_service.py:164`, `consent-protocol/db/db_client.py:275` |
| M-02 | CORS policy broad for credentialed requests | Increased origin attack surface if platform trust assumptions fail | `consent-protocol/server.py:77`, `consent-protocol/server.py:78` |
| M-03 | Debug surface exists in deployed app object | Operational exposure if environment controls are weak | `consent-protocol/server.py:199`, `consent-protocol/server.py:221` |
| M-04 | Frontend lint debt is high (`120` warnings) | Elevated maintainability and regression risk | `npm run lint` result (second-pass rescan) |
| M-05 | Duplicate mobile hook implementation | Behavior inconsistency and maintenance overhead | `hushh-webapp/hooks/use-mobile.ts:3`, `hushh-webapp/hooks/use-mobile.tsx:5` |

### Low Findings
| ID | Finding | Business Impact | Evidence |
|---|---|---|---|
| L-01 | Dependency and static-analysis findings remain | Hygiene debt, lower immediate exploitability | `npm audit --audit-level=high` (6 moderate), `bandit` (21 low issues) |
| L-02 | Deprecated API/test warnings in runtime/tests | Future upgrade friction | `consent-protocol/hushh_mcp/services/portfolio_parser.py:63`, `consent-protocol/tests/test_vault.py:86` |

## 7. Verification Results (Second Pass)
Re-run outcomes:
- `python3 -m pytest tests/ -q`: **PASS** (`183` tests)
- `python3 -m pytest tests/quality -q`: **PASS** (`50` tests)
- `npm run typecheck`: **PASS**
- `npm run lint`: **PASS with 120 warnings**
- `npm test`: **PASS** (`30` tests)
- `npm run verify:routes`: **FAIL** (`app/api/app-config/review-mode/route.ts` undeclared)
- `python3 -m bandit ...`: **issues found** (`21` low)
- `npm audit --audit-level=high`: **6 moderate vulnerabilities**

## 8. Minimum Baseline for Regulated Deployment
Required controls that are currently missing or incomplete:
1. Public-to-private boundary hardening for review mode credentials and admin/test flows.
2. Mandatory authentication on consent event streams and user-lookup endpoints.
3. Secrets governance:
   - No sensitive credentials in client-exposed endpoints.
   - No sensitive secrets in `NEXT_PUBLIC_*` scope.
   - Enforced secret scanning in CI.
4. Token lifecycle correctness:
   - Revocation checks with cross-instance consistency on primary auth path.
   - Active token model keyed by `(user_id, agent_id, scope)` not `scope` alone.
5. Contract governance:
   - `verify:routes` must be green and blocking in CI.
6. Placeholder surface elimination:
   - Remove or feature-gate incomplete identity and sync routes from production path.
7. Logging policy:
   - Structured logs with redaction and minimum required fields only.

## 9. Prioritized Remediation Plan

### Phase 0 (0-7 days)
1. Stop returning reviewer credentials from backend and frontend config surfaces.
2. Add authentication requirement for both consent SSE routes.
3. Protect or remove `/api/user/lookup`.
4. Fix route-contract drift and make it a hard gate.
5. Remove or hard-disable incomplete production placeholder endpoints.

### Phase 1 (1-4 weeks)
1. Enforce DB-aware revocation checks in primary token auth dependency.
2. Refactor consent active-token model to per-agent-per-scope state.
3. Implement logging redaction policy and remove high-risk logs.
4. Reduce frontend lint warnings to an agreed threshold (for example: <=20).

### Phase 2 (1-2 months)
1. Replace sync placeholders with actual reconciliation logic and conflict policy.
2. Improve async DB posture to avoid blocking patterns.
3. Add compliance evidence artifacts:
   - control-to-test mapping
   - immutable audit export verification
   - release sign-off checklist for regulated changes

## 10. Leadership Decision Gate
Decision for investor-regulated production exposure at this time: **No-go**.

Condition to move to conditional go:
- All `Critical` findings closed.
- At least `H-01` and `H-02` closed.
- Route contract gate green.
- Review mode and identity/sync production paths cleaned or feature-gated.

## 11. TL;DR
The codebase is structurally organized and test-active, but it is not yet safe for a highly regulated investor environment. The main blockers are credential exposure, unauthenticated consent telemetry, user enumeration, and incomplete production paths. Fix those first, then harden token lifecycle and governance gates. Once those are closed, the project can move from moderate engineering maturity to regulated-readiness trajectory.

