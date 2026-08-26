import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./trpc/routers/index.js";
import { createContext } from "./trpc/context.js";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks/github.js";

import { githubInstallRoutes } from "./routes/github/install.js";
import { cloudConnectRoutes } from "./routes/cloud-connect.js";
import { azureOAuthRoutes } from "./routes/azure-oauth.js";
import { logRoutes } from "./routes/logs.js";
import { rollbackRoutes } from "./routes/rollback.js";
import { previewRoutes } from "./routes/preview.js";


export async function buildApp(opts?: { logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts?.logger ?? false,
  });

  // Enable CORS
  await app.register(cors, {
    origin: true,
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
