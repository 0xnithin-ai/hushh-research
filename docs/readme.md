# Hushh Documentation

> Single entry point for all project documentation.

Hushh is a **Personal Agent (PA)** platform where users own their data, agents are bound by consent, and encryption keys never leave the client. The architecture enforces four invariants:

1. **BYOK** -- Bring Your Own Key. Server stores ciphertext only.
2. **Consent-First** -- All data access requires a cryptographic consent token. No bypasses.
3. **Tri-Flow** -- Every feature works on Web, iOS, and Android.
4. **Minimal Browser Storage** -- Sensitive credentials stay in React memory; selected non-sensitive UI/cache data may use browser storage.

For repo-level setup instructions, see the root [`readme.md`](../readme.md) and [`getting_started.md`](../getting_started.md).

---

## I want to...

| Goal | Document |
| ---- | -------- |
| Understand the north stars and critical rules | [project_context_map.md](./project_context_map.md) |
| Understand the system architecture | [reference/architecture.md](./reference/architecture.md) |
| Learn how data is stored and encrypted | [world-model.md](../consent-protocol/docs/reference/world-model.md) |
| See every API endpoint | [reference/api-contracts.md](./reference/api-contracts.md) |
| Understand the consent token model | [consent-protocol.md](../consent-protocol/docs/reference/consent-protocol.md) |
| Learn how Kai agents work | [kai-agents.md](../consent-protocol/docs/reference/kai-agents.md) |
| **Build a new agent or operon** | [agent-development.md](../consent-protocol/docs/reference/agent-development.md) |
| Set up my dev environment | [guides/getting-started.md](./guides/getting-started.md) |
| Understand subtree sync enforcement | [guides/subtree-sync.md](./guides/subtree-sync.md) |
| Add a new feature end-to-end | [guides/new-feature.md](./guides/new-feature.md) |
| Build for iOS or Android | [guides/mobile.md](./guides/mobile.md) |
| Implement native SSE streaming | [guides/native_streaming.md](./guides/native_streaming.md) |
| Check environment variables | [reference/env-and-secrets.md](./reference/env-and-secrets.md) |
| Review env key matrix | [reference/env-secrets-key-matrix.md](./reference/env-secrets-key-matrix.md) |
| Understand FCM notifications | [fcm-notifications.md](../consent-protocol/docs/reference/fcm-notifications.md) |
| Review the design system | [reference/design-system.md](./reference/design-system.md) |
| Review CI pipeline | [reference/ci.md](./reference/ci.md) |
| Use canonical stream events everywhere | [reference/streaming-contract.md](./reference/streaming-contract.md) |
| Implement a new stream feature | [reference/streaming-implementation-guide.md](./reference/streaming-implementation-guide.md) |
| Check Vertex streaming constraints | [reference/vertex-ai-streaming-notes.md](./reference/vertex-ai-streaming-notes.md) |
| Understand Kai interconnections end-to-end | [reference/kai-interconnection-map.md](./reference/kai-interconnection-map.md) |
| Assess blast radius before merges | [reference/kai-change-impact-matrix.md](./reference/kai-change-impact-matrix.md) |
| Validate world-model evolution safely | [reference/world-model-compatibility-playbook.md](./reference/world-model-compatibility-playbook.md) |
| Fill PR impact map consistently | [reference/pr-impact-checklist.md](./reference/pr-impact-checklist.md) |
| Check runtime DB facts (sanitized snapshot) | [reference/runtime-db-fact-sheet.md](./reference/runtime-db-fact-sheet.md) |
| Read the product vision | [vision/README.md](./vision/README.md) |
| Deep-dive Agent Kai vision | [vision/kai/README.md](./vision/kai/README.md) |

---

## Sub-Project Documentation

| Location | Purpose | Entry Point |
| -------- | ------- | ----------- |
| `consent-protocol/docs/` | Backend-specific docs | [README.md](../consent-protocol/docs/README.md) |
| `hushh-webapp/docs/` | Frontend-specific docs | [plugin-api-reference.md](../hushh-webapp/docs/plugin-api-reference.md) |

---

## Directory Structure

```
docs/
  readme.md                          # This file (entry point)
  project_context_map.md             # North stars, critical rules, repo map

  reference/                         # What IS the system
    architecture.md                  # System diagram, backend, frontend, DB, security
    api-contracts.md                 # Every endpoint, auth, developer API
    route_contracts.md               # Next.js route governance (tri-flow contracts)
    design-system.md                 # Morphy-UX + Shadcn design system
    env-and-secrets.md               # All environment variables and GCP secrets
    env-secrets-key-matrix.md        # Key-level source matrix for env + Secret Manager + Cloud Run
    ci.md                            # CI/CD pipeline
    streaming-contract.md            # Canonical SSE schema and event contract
    streaming-implementation-guide.md # Reusable implementation pattern
    vertex-ai-streaming-notes.md     # Vertex streaming constraints and anti-patterns
    kai-interconnection-map.md       # End-to-end Kai route/service/cache/data map
    kai-change-impact-matrix.md      # Blast-radius matrix and rollback guidance
    mobile-kai-parity-map.md         # Route + feature parity map for Web/iOS/Android
    world-model-compatibility-playbook.md # Migration-safe world-model rules
    pr-impact-checklist.md           # Mandatory PR impact mapping
    runtime-db-fact-sheet.md         # Sanitized runtime table/function snapshot

  guides/                            # How do I DO something
    getting-started.md               # Prerequisites, setup, run, deploy
    new-feature.md                   # Feature checklist (tri-flow)
    mobile.md                        # Capacitor iOS/Android development
    native_streaming.md              # Native SSE streaming implementation

  vision/                            # Where is this going
    README.md                        # Philosophy, roadmap, community strategy
    kai/
      README.md                      # Agent Kai full product vision
      data/
        investor-master-list.md      # Target investor profiles
        investor_profiles_sample.json # Sample data

consent-protocol/docs/
  README.md                          # Backend entry point
  manifesto.md                       # Hushh philosophy (timeless)
  mcp-setup.md                       # MCP server setup for Claude Desktop
  reference/
    agent-development.md             # DNA model, operons, how to build agents
    world-model.md                   # Two-table architecture, BYOK, MCP scoping
    kai-agents.md                    # 3 agents, debate engine, streaming, Renaissance
    consent-protocol.md              # Token model, security layers, compliance
    fcm-notifications.md             # FCM push notification architecture

hushh-webapp/docs/
  plugin-api-reference.md            # Native Capacitor plugin APIs
```

**Docs live across three documentation homes: `docs/`, `consent-protocol/docs/`, and `hushh-webapp/docs/`. Every file earns its place.**
