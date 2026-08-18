# Contributing to Shipora

Thank you for your interest in contributing! This guide will help you get started.

---

## Development Setup

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker (for local container testing)
- A GitHub App (see [docs/GITHUB_APP_SETUP.md](docs/GITHUB_APP_SETUP.md))

### Getting Started

```bash
# 1. Fork and clone the repo
git clone https://github.com/your-org/shipora.git
cd shipora

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env
# Fill in your values

# 4. Run DB migrations
pnpm db:migrate

# 5. Start dev servers
pnpm dev
```

---

## Project Structure

See [README.md](README.md#project-structure) for the full monorepo layout.

The key entry points are:
- **Frontend**: `apps/web/src/app/` (Next.js App Router)
- **API**: `apps/api/src/router/` (tRPC routers)
- **Worker**: `apps/temporal-worker/src/activities/` (Temporal activities)
- **DB Schema**: `packages/db/src/schema.ts`

---

## Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Production — protected, requires PR |
| `staging` | Staging environment |
| `feat/*` | Feature branches |
| `fix/*` | Bug fix branches |
| `chore/*` | Maintenance, refactoring |

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(worker): add lockfile health scanner activity
fix(api): handle missing GitHub installation gracefully
chore(db): add index to deployments.project_id
docs(agents): update rollback agent retry policy
```

---

## Pull Request Process

1. Create a branch from `main`: `feat/your-feature`
2. Make your changes
3. Run checks locally:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm build
   ```
4. Open a PR against `main`
5. A Shipora conflict guard check will run automatically on your PR ✨
6. Get at least one review approval
7. Squash and merge

---

## Adding a New Temporal Activity

1. Define the input/output types in `packages/types/src/activities.ts`
2. Add the activity function to `apps/temporal-worker/src/activities/`
3. Register the activity in `apps/temporal-worker/src/index.ts`
4. Add the activity stub to the workflow in `packages/temporal-workflows/src/`
5. Document the new agent in `docs/AGENTS.md`

---

## Code Style

- **TypeScript strict mode** — no `any`, no implicit returns
- **Zod** for all runtime validation at API boundaries
- **Drizzle** for all database queries — no raw SQL unless absolutely necessary
- **tRPC** for all frontend ↔ API communication — no `fetch` calls from the frontend to the API

---

## Questions?

Open an issue or start a discussion on GitHub.
