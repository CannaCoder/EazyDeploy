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

export type Database = ReturnType<typeof createDbClient>;

// Lazy singleton — created on first access so that DATABASE_URL is guaranteed
// to be present in process.env regardless of module load order (e.g. when
// worker.ts calls loadEnvSafe() after the module graph is resolved).
let _db: Database | undefined;
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    if (!_db) {
      _db = createDbClient();
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
