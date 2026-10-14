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

  // Create enum types (Phase 1 + Phase 2)
  mem.public.none(`
    CREATE TYPE "membership_approval_state" AS ENUM('pending', 'approved', 'rejected');
    CREATE TYPE "membership_role" AS ENUM('customer', 'artist', 'administrator');
    CREATE TYPE "otp_purpose" AS ENUM('login', 'phone_change');
    CREATE TYPE "user_status" AS ENUM('active', 'suspended', 'deactivated');

    CREATE TYPE "artist_publication_state" AS ENUM('draft', 'pending_review', 'published', 'archived');
    CREATE TYPE "media_type" AS ENUM('image', 'video', 'audio', 'document');
    CREATE TYPE "media_scan_state" AS ENUM('pending', 'clean', 'flagged');
    CREATE TYPE "media_visibility" AS ENUM('public', 'private');
    CREATE TYPE "application_status" AS ENUM('pending', 'under_review', 'approved', 'rejected');
  `);

  // Create tables (Phase 1 + Phase 2)
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

    CREATE TABLE "locations" (
      "id" varchar(50) PRIMARY KEY NOT NULL,
      "name" varchar(100) NOT NULL,
      "state" varchar(100) NOT NULL,
      "country" varchar(10) DEFAULT 'IN' NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "categories" (
      "id" varchar(50) PRIMARY KEY NOT NULL,
      "name" varchar(100) NOT NULL,
      "description" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "artist_profiles" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "slug" varchar(100) NOT NULL UNIQUE,
      "stage_name" varchar(150) NOT NULL,
      "tagline" varchar(255),
      "bio" text,
      "city_id" varchar(50) REFERENCES "locations"("id"),
      "publication_state" "artist_publication_state" DEFAULT 'draft' NOT NULL,
      "starting_price_minor" integer DEFAULT 0 NOT NULL,
      "currency" varchar(10) DEFAULT 'INR' NOT NULL,
      "experience_years" integer,
      "cover_image_url" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX "artist_profiles_user_id_idx" ON "artist_profiles" ("user_id");
    CREATE UNIQUE INDEX "artist_profiles_slug_idx" ON "artist_profiles" ("slug");
    CREATE INDEX "artist_profiles_pub_city_idx" ON "artist_profiles" ("publication_state", "city_id");

    CREATE TABLE "artist_categories" (
      "artist_id" uuid NOT NULL REFERENCES "artist_profiles"("id") ON DELETE cascade,
      "category_id" varchar(50) NOT NULL REFERENCES "categories"("id") ON DELETE cascade,
      PRIMARY KEY ("artist_id", "category_id")
    );

    CREATE INDEX "artist_categories_cat_idx" ON "artist_categories" ("category_id");

    CREATE TABLE "artist_packages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "artist_id" uuid NOT NULL REFERENCES "artist_profiles"("id") ON DELETE cascade,
      "title" varchar(150) NOT NULL,
      "description" text,
      "duration_minutes" integer NOT NULL,
      "capacity" integer,
      "fee_minor" integer NOT NULL,
      "currency" varchar(10) DEFAULT 'INR' NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX "artist_packages_artist_idx" ON "artist_packages" ("artist_id");

    CREATE TABLE "media_assets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "storage_key" varchar(255) NOT NULL,
      "url" text NOT NULL,
      "media_type" "media_type" DEFAULT 'image' NOT NULL,
      "scan_state" "media_scan_state" DEFAULT 'clean' NOT NULL,
      "visibility" "media_visibility" DEFAULT 'public' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX "media_assets_owner_idx" ON "media_assets" ("owner_id");

    CREATE TABLE "shortlist_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "customer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "artist_id" uuid NOT NULL REFERENCES "artist_profiles"("id") ON DELETE cascade,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX "shortlist_cust_artist_idx" ON "shortlist_items" ("customer_id", "artist_id");
    CREATE INDEX "shortlist_customer_idx" ON "shortlist_items" ("customer_id");

    CREATE TABLE "artist_applications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "status" "application_status" DEFAULT 'pending' NOT NULL,
      "notes" text,
      "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
      "reviewed_at" timestamp with time zone,
      "reviewed_by" uuid REFERENCES "users"("id")
    );

    CREATE INDEX "artist_applications_user_idx" ON "artist_applications" ("user_id");
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
