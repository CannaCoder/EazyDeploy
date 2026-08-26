# syntax=docker/dockerfile:1
# ─── Stage 1: Dependencies ─────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ git
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

COPY packages/types/package.json              ./packages/types/package.json
COPY packages/db/package.json                 ./packages/db/package.json
COPY packages/cloud-adapters/package.json     ./packages/cloud-adapters/package.json
COPY packages/temporal-workflows/package.json ./packages/temporal-workflows/package.json
COPY packages/github-app/package.json         ./packages/github-app/package.json
COPY packages/code-analyzer/package.json      ./packages/code-analyzer/package.json
COPY apps/temporal-worker/package.json        ./apps/temporal-worker/package.json

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm --filter @shipora/types build 2>/dev/null || true
RUN pnpm --filter @shipora/db build 2>/dev/null || true

# ─── Stage 3: Production runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy dependencies and sources
COPY --from=deps    /app/node_modules                 ./node_modules
COPY --from=builder /app/apps/temporal-worker         ./apps/temporal-worker
COPY --from=builder /app/packages/types               ./packages/types
COPY --from=builder /app/packages/db                  ./packages/db
COPY --from=builder /app/packages/cloud-adapters      ./packages/cloud-adapters
COPY --from=builder /app/packages/github-app          ./packages/github-app
COPY --from=builder /app/packages/code-analyzer       ./packages/code-analyzer
COPY --from=builder /app/packages/temporal-workflows  ./packages/temporal-workflows

CMD ["node", "--loader", "tsx/esm", "apps/temporal-worker/src/index.ts"]
