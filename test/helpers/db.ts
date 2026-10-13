import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/server/db/schema";
import { setTestDb } from "@/server/db";
import { randomUUID } from "node:crypto";

export function setupTestDatabase() {
  const mem = newDb();

  // Register gen_random_uuid with impure: true so it generates a fresh UUID for every call
  mem.public.registerFunction({
    name: "gen_random_uuid",
    returns: mem.public.getType("uuid" as any),
    impure: true,
    implementation: () => randomUUID(),
  });

  // Create enum types
  mem.public.none(`
    CREATE TYPE "membership_approval_state" AS ENUM('pending', 'approved', 'rejected');
    CREATE TYPE "membership_role" AS ENUM('customer', 'artist', 'administrator');
    CREATE TYPE "otp_purpose" AS ENUM('login', 'phone_change');
    CREATE TYPE "user_status" AS ENUM('active', 'suspended', 'deactivated');
  `);

  // Create tables
  mem.public.none(`
    CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "phone" varchar(20) NOT NULL UNIQUE,
      "name" varchar(100),
      "status" "user_status" DEFAULT 'active' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "memberships" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "role" "membership_role" NOT NULL,
      "approval_state" "membership_approval_state" DEFAULT 'approved' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX "memberships_user_role_idx" ON "memberships" ("user_id", "role");

    CREATE TABLE "sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "token_hash" varchar(64) NOT NULL UNIQUE,
      "idle_expires_at" timestamp with time zone NOT NULL,
      "absolute_expires_at" timestamp with time zone NOT NULL,
      "revoked_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "otp_challenges" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "phone" varchar(20) NOT NULL,
      "code_hmac" varchar(128) NOT NULL,
      "purpose" "otp_purpose" DEFAULT 'login' NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "max_attempts" integer DEFAULT 5 NOT NULL,
      "attempts_used" integer DEFAULT 0 NOT NULL,
      "resend_available_at" timestamp with time zone NOT NULL,
      "consumed_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  const pg = mem.adapters.createPg();

  // Patch Client prototype to handle Drizzle's rowMode = 'array' and types parser
  const originalAdaptResults = (pg.Client.prototype as any).adaptResults;
  (pg.Client.prototype as any).adaptResults = function (query: any, res: any) {
    if (query && query.rowMode === "array") {
      const fieldNames = res.fields.map((f: any) => f.name);
      return {
        ...res,
        rows: res.rows.map((row: any) => fieldNames.map((name: string) => row[name])),
      };
    }
    return originalAdaptResults.call(this, query, res);
  };

  const pool = new pg.Pool();

  // Intercept pool.query to remove Drizzle's `types` configuration that pg-mem throws on
  const originalQuery = pool.query.bind(pool);
  pool.query = function (queryTextOrConfig: any, valuesOrCb?: any, cb?: any) {
    if (queryTextOrConfig && typeof queryTextOrConfig === "object" && queryTextOrConfig.types) {
      delete queryTextOrConfig.types;
    }
    return originalQuery(queryTextOrConfig, valuesOrCb, cb);
  } as any;

  const originalConnect = pool.connect.bind(pool);
  pool.connect = async function () {
    const client = await originalConnect();
    const origClientQuery = client.query.bind(client);
    client.query = function (queryTextOrConfig: any, valuesOrCb?: any, cb?: any) {
      if (queryTextOrConfig && typeof queryTextOrConfig === "object" && queryTextOrConfig.types) {
        delete queryTextOrConfig.types;
      }
      return origClientQuery(queryTextOrConfig, valuesOrCb, cb);
    } as any;
    return client;
  } as any;

  const testDb = drizzle(pool, { schema });
  setTestDb(testDb, pool);

  return { mem, pool, testDb };
}
