import { pgTable, uuid, text, bigint, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  githubId: bigint("github_id", { mode: "number" }).unique(),
  email: text("email").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserTable = typeof users.$inferSelect;
export type NewUserTable = typeof users.$inferInsert;
