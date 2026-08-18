import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // nextjs | vite | node | fastapi | docker
  rootPath: text("root_path").notNull(),
  port: integer("port"),
  buildCommand: text("build_command"),
  ecsServiceArn: text("ecs_service_arn"),
  currentTaskDef: text("current_task_def"),
  previousTaskDef: text("previous_task_def"),
  serviceUrl: text("service_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ServiceTable = typeof services.$inferSelect;
export type NewServiceTable = typeof services.$inferInsert;
