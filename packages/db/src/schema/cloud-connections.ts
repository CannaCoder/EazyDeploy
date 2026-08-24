import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { projects } from "./projects.js";

export const cloudConnections = pgTable("cloud_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" }), // nullable: null = account-level default
  provider: text("provider").notNull(), // 'aws' | 'azure' | 'digitalocean' | 'gcp'
  displayName: text("display_name"),

  // AWS-specific credentials / configs
  roleArn: text("role_arn"),
  externalId: text("external_id"),

  // Azure-specific credentials / configs
  tenantId: text("tenant_id"),
  clientId: text("client_id"),
  clientSecretRef: text("client_secret_ref"), // Reference to secret stored in vault or encrypted
  subscriptionId: text("subscription_id"),
  resourceGroup: text("resource_group"),

  // Status & Timestamps
  status: text("status").notNull().default("connected"), // 'connected' | 'disconnected' | 'expired' | 'error'
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CloudConnectionTable = typeof cloudConnections.$inferSelect;
export type NewCloudConnectionTable = typeof cloudConnections.$inferInsert;
