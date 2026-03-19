# Getting Started

This is the repo-root contributor entrypoint. The maintained onboarding path lives in:

- [docs/guides/getting-started.md](./docs/guides/getting-started.md)
- [docs/guides/environment-model.md](./docs/guides/environment-model.md)
- [docs/guides/advanced-ops.md](./docs/guides/advanced-ops.md)

## Stack In One Screen

- Frontend: Next.js 16, React 19, Capacitor
- Backend: FastAPI on Python 3.13
- Storage: Postgres plus encrypted world-model blob/index
- Auth: Firebase
- Environments: `local-uatdb`, `uat-remote`, `prod-remote`

## Canonical Commands

```bash
git clone https://github.com/hushh-labs/hushh-research.git
cd hushh-research
make bootstrap
make doctor PROFILE=uat-remote
make web PROFILE=uat-remote
```

Use `make dev PROFILE=local-uatdb` when you need the full local stack. Use `make web PROFILE=prod-remote` only when you intentionally want to inspect production behavior from a local frontend.

## Read In This Order

1. [docs/guides/getting-started.md](./docs/guides/getting-started.md)
2. [docs/guides/environment-model.md](./docs/guides/environment-model.md)
3. [docs/reference/architecture/architecture.md](./docs/reference/architecture/architecture.md)
4. [docs/guides/advanced-ops.md](./docs/guides/advanced-ops.md)

## Package References

- Backend details: [consent-protocol/docs/README.md](./consent-protocol/docs/README.md)
- Frontend/native details: [hushh-webapp/docs/README.md](./hushh-webapp/docs/README.md)
