# syntax=docker/dockerfile:1
# ─── Stage 1: Dependencies ─────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

COPY packages/types/package.json              ./packages/types/package.json
COPY packages/db/package.json                 ./packages/db/package.json
COPY packages/cloud-adapters/package.json     ./packages/cloud-adapters/package.json
COPY packages/temporal-workflows/package.json ./packages/temporal-workflows/package.json
COPY packages/github-app/package.json         ./packages/github-app/package.json
COPY packages/code-analyzer/package.json      ./packages/code-analyzer/package.json
COPY apps/api/package.json                    ./apps/api/package.json

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --shamefully-hoist

# ─── Stage 2: Production runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0
ENV PATH="/app/node_modules/.bin:${PATH}"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 apiuser

# Copy only what the API needs
COPY --from=deps    /app/node_modules                 ./node_modules
COPY                ./apps/api                        ./apps/api
COPY                ./packages/types                  ./packages/types
COPY                ./packages/db                     ./packages/db
COPY                ./packages/cloud-adapters         ./packages/cloud-adapters
COPY                ./packages/github-app             ./packages/github-app
COPY                ./packages/code-analyzer          ./packages/code-analyzer
COPY                ./packages/temporal-workflows     ./packages/temporal-workflows

USER apiuser
EXPOSE 4000

CMD ["tsx", "apps/api/src/index.ts"]
