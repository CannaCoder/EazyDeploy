import { pgTable, uuid, text, bigint, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  githubRepoOwner: text("github_repo_owner").notNull(),
  githubRepoName: text("github_repo_name").notNull(),
  githubInstallationId: bigint("github_installation_id", { mode: "number" }).notNull(),
  productionBranch: text("production_branch").notNull().default("main"),
  envSecretArn: text("env_secret_arn"),
  cloudProvider: text("cloud_provider").notNull().default("aws"),
  cloudConnectionId: uuid("cloud_connection_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectTable = typeof projects.$inferSelect;
export type NewProjectTable = typeof projects.$inferInsert;

