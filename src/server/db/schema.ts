import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deactivated"]);
export const membershipRoleEnum = pgEnum("membership_role", ["customer", "artist", "administrator"]);
export const membershipApprovalStateEnum = pgEnum("membership_approval_state", ["pending", "approved", "rejected"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["login", "phone_change"]);

// Phase 2 Enums
export const artistPublicationStateEnum = pgEnum("artist_publication_state", [
  "draft",
  "pending_review",
  "published",
  "archived",
]);
export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "audio", "document"]);
export const mediaScanStateEnum = pgEnum("media_scan_state", ["pending", "clean", "flagged"]);
export const mediaVisibilityEnum = pgEnum("media_visibility", ["public", "private"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
]);

// 1. Users Table
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull().unique(), // E.164 normalized
    name: varchar("name", { length: 100 }),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_phone_idx").on(table.phone),
  ]
);

// 2. Memberships Table
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    approvalState: membershipApprovalStateEnum("approval_state").notNull().default("approved"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("memberships_user_role_idx").on(table.userId, table.role),
    index("memberships_user_id_idx").on(table.userId),
  ]
);

// 3. Sessions Table
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // SHA-256 hash (64 hex characters)
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ]
);

// 4. OtpChallenges Table
export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull(), // normalized E.164 phone
    codeHmac: varchar("code_hmac", { length: 128 }).notNull(), // HMAC of code with secret
    purpose: otpPurposeEnum("purpose").notNull().default("login"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    maxAttempts: integer("max_attempts").notNull().default(5),
    attemptsUsed: integer("attempts_used").notNull().default(0),
    resendAvailableAt: timestamp("resend_available_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("otp_challenges_phone_idx").on(table.phone),
  ]
);

// ==========================================
// Phase 2: Catalog & Onboarding Tables
// ==========================================

// 5. Locations Table
export const locations = pgTable("locations", {
  id: varchar("id", { length: 50 }).primaryKey(), // slug like 'chennai', 'bangalore', 'mumbai'
  name: varchar("name", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  country: varchar("country", { length: 10 }).notNull().default("IN"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 6. Categories Table
export const categories = pgTable("categories", {
  id: varchar("id", { length: 50 }).primaryKey(), // slug like 'music-and-dance', 'live-painting'
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 7. ArtistProfiles Table
export const artistProfiles = pgTable(
  "artist_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    stageName: varchar("stage_name", { length: 150 }).notNull(),
    tagline: varchar("tagline", { length: 255 }),
    bio: text("bio"),
    cityId: varchar("city_id", { length: 50 }).references(() => locations.id),
    publicationState: artistPublicationStateEnum("publication_state").notNull().default("draft"),
    startingPriceMinor: integer("starting_price_minor").notNull().default(0),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    experienceYears: integer("experience_years"),
    coverImageUrl: text("cover_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("artist_profiles_user_id_idx").on(table.userId),
    uniqueIndex("artist_profiles_slug_idx").on(table.slug),
    index("artist_profiles_pub_city_idx").on(table.publicationState, table.cityId),
  ]
);

// 8. ArtistCategories Junction Table
export const artistCategories = pgTable(
  "artist_categories",
  {
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    categoryId: varchar("category_id", { length: 50 })
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.artistId, table.categoryId] }),
    index("artist_categories_cat_idx").on(table.categoryId),
  ]
);

// 9. ArtistPackages Table
export const artistPackages = pgTable(
  "artist_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 150 }).notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    capacity: integer("capacity"),
    feeMinor: integer("fee_minor").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("artist_packages_artist_idx").on(table.artistId),
  ]
);

// 10. MediaAssets Table
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 255 }).notNull(),
    url: text("url").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull().default("image"),
    scanState: mediaScanStateEnum("scan_state").notNull().default("clean"),
    visibility: mediaVisibilityEnum("visibility").notNull().default("public"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("media_assets_owner_idx").on(table.ownerId),
  ]
);

// 11. ShortlistItems Table
export const shortlistItems = pgTable(
  "shortlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shortlist_cust_artist_idx").on(table.customerId, table.artistId),
    index("shortlist_customer_idx").on(table.customerId),
  ]
);

// 12. ArtistApplications Table
export const artistApplications = pgTable(
  "artist_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
  },
  (table) => [
    index("artist_applications_user_idx").on(table.userId),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  memberships: many(memberships),
  sessions: many(sessions),
  artistProfile: one(artistProfiles, {
    fields: [users.id],
    references: [artistProfiles.userId],
  }),
  shortlistItems: many(shortlistItems),
  mediaAssets: many(mediaAssets),
  artistApplications: many(artistApplications),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const artistProfilesRelations = relations(artistProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [artistProfiles.userId],
    references: [users.id],
  }),
  city: one(locations, {
    fields: [artistProfiles.cityId],
    references: [locations.id],
  }),
  packages: many(artistPackages),
  categories: many(artistCategories),
  shortlistedBy: many(shortlistItems),
}));

export const artistCategoriesRelations = relations(artistCategories, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [artistCategories.artistId],
    references: [artistProfiles.id],
  }),
  category: one(categories, {
    fields: [artistCategories.categoryId],
    references: [categories.id],
  }),
}));

export const artistPackagesRelations = relations(artistPackages, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [artistPackages.artistId],
    references: [artistProfiles.id],
  }),
}));

export const shortlistItemsRelations = relations(shortlistItems, ({ one }) => ({
  customer: one(users, {
    fields: [shortlistItems.customerId],
    references: [users.id],
  }),
  artist: one(artistProfiles, {
    fields: [shortlistItems.artistId],
    references: [artistProfiles.id],
  }),
}));
