import { pgTable, uuid, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import type { FailureDetail } from "@shipora/types";

export const conflictChecks = pgTable("conflict_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  commitSha: text("commit_sha").notNull(),
  branch: text("branch").notNull(),
  status: text("status").notNull(), // running | passed | failed
  mergeConflicts: boolean("merge_conflicts"),
  lockfileHealthy: boolean("lockfile_healthy"),
  envVarsValid: boolean("env_vars_valid"),
  failureDetails: jsonb("failure_details").$type<FailureDetail[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConflictCheckTable = typeof conflictChecks.$inferSelect;
export type NewConflictCheckTable = typeof conflictChecks.$inferInsert;
