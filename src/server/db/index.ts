import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config";
import * as schema from "./schema";

const { Pool } = pg;

const globalForDb = globalThis as unknown as {
  pool: pg.Pool | undefined;
  db: ReturnType<typeof drizzle> | undefined;
};

export function createPgPool(): pg.Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
  });
}

export let pool = globalForDb.pool ?? createPgPool();
export let db = globalForDb.db ?? drizzle(pool, { schema });

// Helper to swap DB instance for integration tests or custom in-memory pools
export function setTestDb(newDb: any, newPool?: any) {
  db = newDb;
  if (newPool) {
    pool = newPool;
  }
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
  globalForDb.db = db;
}
