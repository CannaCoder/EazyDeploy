import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import { clerkPlugin } from "@clerk/fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./trpc/routers/index.js";
import { createContext } from "./trpc/context.js";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks/github.js";

import { githubInstallRoutes } from "./routes/github/install.js";
import { cloudConnectRoutes } from "./routes/cloud-connect.js";
import { azureOAuthRoutes } from "./routes/azure-oauth.js";
import { digitalOceanOAuthRoutes } from "./routes/digitalocean-oauth.js";
import { gcpOAuthRoutes } from "./routes/gcp-oauth.js";
import { logRoutes } from "./routes/logs.js";
import { rollbackRoutes } from "./routes/rollback.js";
import { previewRoutes } from "./routes/preview.js";


import { env } from "./env.js";

export async function buildApp(opts?: { logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts?.logger ?? false,
  });

  // Register Clerk plugin for Fastify auth decoration when Clerk keys are configured
  const publishableKey = process.env["CLERK_PUBLISHABLE_KEY"] || process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const secretKey = process.env["CLERK_SECRET_KEY"];

  if (publishableKey && secretKey) {
    await app.register(clerkPlugin, {
      publishableKey,
      secretKey,
    });
  }

  // Enable CORS with strict origin validation
  const isDev = env.NODE_ENV !== "production";
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, server-to-server, health check probes)
      if (!origin) return cb(null, true);

      // In development or test, allow any localhost origin
      if (isDev && (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin))) {
        return cb(null, true);
      }

      const allowedOrigins = [
        env.WEB_DASHBOARD_URL,
        "https://shipora.app",
        "https://www.shipora.app",
      ].filter(Boolean);

      // Support additional comma-separated origins from CORS_ORIGINS env var
      const extra = (process.env["CORS_ORIGINS"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const allAllowed = [...allowedOrigins, ...extra];

      let isAllowed = allAllowed.some((allowed) => {
        try {
          return new URL(origin).origin === new URL(allowed).origin;
        } catch {
          return origin === allowed;
        }
      });

      if (!isAllowed) {
        try {
          const { hostname } = new URL(origin);
          isAllowed = hostname === "shipora.app" || hostname.endsWith(".shipora.app");
        } catch {
          isAllowed = false;
        }
      }

      if (isAllowed) {
        return cb(null, true);
      }

      return cb(new Error("CORS policy: origin not allowed"), false);
    },
    credentials: true,
  });

  // Enable raw body parser for webhook signatures
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
    routes: ["/webhooks/github"],
  });

  // Register REST routes
  await app.register(healthRoutes);
  await app.register(webhookRoutes);
  await app.register(githubInstallRoutes);
  await app.register(cloudConnectRoutes);
  await app.register(azureOAuthRoutes);
  await app.register(digitalOceanOAuthRoutes);
  await app.register(gcpOAuthRoutes);
  // Phase 4 — Observability & Rollback
  await app.register(logRoutes);
  await app.register(rollbackRoutes);
  await app.register(previewRoutes);

  // Register tRPC plugin
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }: { path?: string; error: Error }) {
        app.log.error(`[tRPC Error] ${path}: ${error.message}`);
      },
    },
  });

  return app;
}
