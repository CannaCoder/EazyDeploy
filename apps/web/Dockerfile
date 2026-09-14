# syntax=docker/dockerfile:1
# ─── Stage 1: Dependencies ─────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy root workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy all package manifests (needed for workspace install)
COPY packages/types/package.json         ./packages/types/package.json
COPY packages/ui/package.json            ./packages/ui/package.json
COPY packages/db/package.json            ./packages/db/package.json
COPY packages/cloud-adapters/package.json ./packages/cloud-adapters/package.json
COPY packages/temporal-workflows/package.json ./packages/temporal-workflows/package.json
COPY packages/github-app/package.json   ./packages/github-app/package.json
COPY packages/code-analyzer/package.json ./packages/code-analyzer/package.json
COPY apps/api/package.json              ./apps/api/package.json
COPY apps/web/package.json              ./apps/web/package.json

# Install pnpm and all dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --shamefully-hoist

# ─── Stage 2: Builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules       ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source files
COPY . .

# Enable standalone output (smaller Docker image)
ENV NEXT_TELEMETRY_DISABLED=1

# Build the web app only
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm --filter web build

# ─── Stage 3: Production runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy public assets and the standalone build
COPY --from=builder /app/apps/web/public             ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./.next/static

USER nextjs
EXPOSE 3000

# Use Next.js standalone server
CMD ["node", "server.js"]
