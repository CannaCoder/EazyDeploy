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
RUN pnpm install --frozen-lockfile --shamefully-hoist

# ─── Stage 2: Production runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:${PATH}"

# Copy dependencies and sources
COPY --from=deps    /app/node_modules                 ./node_modules
COPY                ./apps/temporal-worker            ./apps/temporal-worker
COPY                ./packages/types                  ./packages/types
COPY                ./packages/db                     ./packages/db
COPY                ./packages/cloud-adapters         ./packages/cloud-adapters
COPY                ./packages/github-app             ./packages/github-app
COPY                ./packages/code-analyzer          ./packages/code-analyzer
COPY                ./packages/temporal-workflows     ./packages/temporal-workflows

CMD ["tsx", "apps/temporal-worker/src/index.ts"]
