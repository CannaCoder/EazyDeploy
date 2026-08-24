import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { users } from "./users.js";

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  commitSha: text("commit_sha").notNull(),
  branch: text("branch").notNull(),
  status: text("status").notNull(), // pending | building | deploying | verifying | rolling_back | success | failed | rolled_back
  triggeredBy: uuid("triggered_by").references(() => users.id, { onDelete: "set null" }),
  temporalWorkflowId: text("temporal_workflow_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Phase 4 — Observability & Rollback
  deployedUrls: jsonb("deployed_urls"), // { [serviceName]: url }
  previousRevisionRefs: jsonb("previous_revision_refs"), // { [serviceName]: { aws?: taskDefArn, azure?: revisionName } }
  rollbackReason: text("rollback_reason"), // health check failure message or "manual"
  rolledBackTo: uuid("rolled_back_to"), // FK enforced in migration; links rollback -> source deployment
});

export type DeploymentTable = typeof deployments.$inferSelect;
export type NewDeploymentTable = typeof deployments.$inferInsert;
