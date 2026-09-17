import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load from current directory and workspace root
config({ override: true });
config({ path: resolve(process.cwd(), ".env"), override: true });
config({ path: resolve(process.cwd(), "../../.env"), override: true });
config({ path: resolve(new URL(".", import.meta.url).pathname, "../../../.env"), override: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  API_URL: z.string().default("http://localhost:4000"),
  WEB_DASHBOARD_URL: z.string().default("http://localhost:3000"),
  AZURE_TENANT_ID: z.string().default("23543db5-54c7-4b3a-b22c-5f84b5594471"),
  AZURE_CLIENT_ID: z.string().default("00000000-0000-0000-0000-000000000000"),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_REDIRECT_URI: z.string().default("http://localhost:4000/auth/azure/callback"),
  AZURE_SUBSCRIPTION_ID: z.string().optional(),
  DO_CLIENT_ID: z.string().optional(),
  DO_CLIENT_SECRET: z.string().optional(),
  DO_REDIRECT_URI: z.string().default("http://localhost:4000/auth/digitalocean/callback"),
  GCP_CLIENT_ID: z.string().optional(),
  GCP_CLIENT_SECRET: z.string().optional(),
  GCP_REDIRECT_URI: z.string().default("http://localhost:4000/auth/gcp/callback"),
  GCP_PROJECT_ID: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  return EnvSchema.parse(process.env);
}

export const env = getEnv();

