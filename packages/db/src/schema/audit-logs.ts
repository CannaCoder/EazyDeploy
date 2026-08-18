import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { users } from "./users.js";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  event: text("event").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogTable = typeof auditLogs.$inferSelect;
export type NewAuditLogTable = typeof auditLogs.$inferInsert;
