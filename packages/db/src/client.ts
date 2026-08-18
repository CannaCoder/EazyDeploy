import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index.js";

export function createDbClient(connectionString?: string) {
  const url = connectionString || process.env["DATABASE_URL"];
  if (!url) {
    // Return a dummy client proxy or throw on actual query if url is unset
    const sql = neon("postgresql://postgres:postgres@localhost:5432/shipora");
    return drizzle(sql, { schema });
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export const db = createDbClient();
export type Database = ReturnType<typeof createDbClient>;
