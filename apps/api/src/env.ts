import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load from current directory and workspace root
config();
config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

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
  API_URL: z.string().default("http://localhost:4000"),
  WEB_DASHBOARD_URL: z.string().default("http://localhost:3000"),
  AZURE_TENANT_ID: z.string().default("23543db5-54c7-4b3a-b22c-5f84b5594471"),
  AZURE_CLIENT_ID: z.string().default("00000000-0000-0000-0000-000000000000"),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_SUBSCRIPTION_ID: z.string().optional(),
  AZURE_REDIRECT_URI: z.string().default("http://localhost:4000/auth/azure/callback"),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  return EnvSchema.parse(process.env);
}

export const env = getEnv();

