import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { deployments } from "./deployments.js";

/**
 * Persists build and runtime log lines for each deployment.
 * Redis pub/sub channels are ephemeral; this table provides durable
 * storage so past deployment logs remain viewable from the dashboard.
 *
 * Capped in application logic at 5,000 rows per deployment.
 */
export const deploymentLogs = pgTable("deployment_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  deploymentId: uuid("deployment_id")
    .notNull()
    .references(() => deployments.id, { onDelete: "cascade" }),
  serviceName: text("service_name").notNull(),
  logLine: text("log_line").notNull(),
  level: text("level").notNull(), // "info" | "warn" | "error"
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export type DeploymentLogTable = typeof deploymentLogs.$inferSelect;
export type NewDeploymentLogTable = typeof deploymentLogs.$inferInsert;
