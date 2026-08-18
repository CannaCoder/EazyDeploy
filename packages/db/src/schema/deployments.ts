import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { users } from "./users.js";

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  commitSha: text("commit_sha").notNull(),
  branch: text("branch").notNull(),
  status: text("status").notNull(), // pending | building | deploying | success | failed | rolled_back
  triggeredBy: uuid("triggered_by").references(() => users.id, { onDelete: "set null" }),
  temporalWorkflowId: text("temporal_workflow_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DeploymentTable = typeof deployments.$inferSelect;
export type NewDeploymentTable = typeof deployments.$inferInsert;
