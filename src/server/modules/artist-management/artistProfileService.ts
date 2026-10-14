import "server-only";
import { db } from "../../db";
import {
  artistProfiles,
  artistCategories,
  artistPackages,
  artistApplications,
  mediaAssets,
  categories,
} from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { AppError } from "../../api/envelope";
import { getStorageAdapter } from "../../providers/storage";
import { randomUUID } from "node:crypto";

export class ArtistManagementService {
  /**
   * Helper: generate clean slug from stageName
   */
  private generateSlug(stageName: string, userId: string): string {
    const base = stageName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const suffix = userId.slice(0, 8);
    return `${base || "artist"}-${suffix}`;
  }

  // ==========================================
  // Artist Applications
  // ==========================================

  async submitApplication(userId: string, notes?: string) {
    const [existing] = await db
      .select()
      .from(artistApplications)
      .where(eq(artistApplications.userId, userId))
      .limit(1);

    if (existing && existing.status === "pending") {
      throw new AppError(409, "CONFLICT", "An artist application is already pending review.");
    }

    const [app] = await db
      .insert(artistApplications)
      .values({
        userId,
        notes,
        status: "pending",
      })
      .returning();

    return app;
  }

  async getOwnApplication(userId: string) {
    const [app] = await db
      .select()
      .from(artistApplications)
      .where(eq(artistApplications.userId, userId))
      .orderBy(sql`${artistApplications.submittedAt} desc`)
      .limit(1);

    if (!app) {
      throw new AppError(404, "NOT_FOUND", "No artist application found.");
    }

    return app;
  }

  // ==========================================
  // Artist Profile Drafts
  // ==========================================

  async getOrCreateDraftProfile(userId: string) {
    let [profile] = await db
      .select()
      .from(artistProfiles)
      .where(eq(artistProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      const defaultSlug = `artist-${userId.slice(0, 8)}`;
      const [newProfile] = await db
        .insert(artistProfiles)
        .values({
          userId,
          slug: defaultSlug,
          stageName: "Unnamed Artist",
          publicationState: "draft",
        })
        .returning();
      profile = newProfile;
    }

    // Fetch assigned categories
    const assignedCats = await db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(artistCategories)
      .innerJoin(categories, eq(artistCategories.categoryId, categories.id))
      .where(eq(artistCategories.artistId, profile.id));

    return {
      ...profile,
      categories: assignedCats,
    };
  }

  async updateDraftProfile(
    userId: string,
    data: {
      stageName?: string;
      tagline?: string;
      bio?: string;
      cityId?: string;
      startingPriceMinor?: number;
      experienceYears?: number;
      coverImageUrl?: string;
      categoryIds?: string[];
    }
  ) {
    const current = await this.getOrCreateDraftProfile(userId);

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.stageName !== undefined) {
      updateFields.stageName = data.stageName;
      updateFields.slug = this.generateSlug(data.stageName, userId);
    }
    if (data.tagline !== undefined) updateFields.tagline = data.tagline;
    if (data.bio !== undefined) updateFields.bio = data.bio;
    if (data.cityId !== undefined) updateFields.cityId = data.cityId;
    if (data.startingPriceMinor !== undefined) updateFields.startingPriceMinor = data.startingPriceMinor;
    if (data.experienceYears !== undefined) updateFields.experienceYears = data.experienceYears;
    if (data.coverImageUrl !== undefined) updateFields.coverImageUrl = data.coverImageUrl;

    const [updated] = await db
      .update(artistProfiles)
      .set(updateFields)
      .where(eq(artistProfiles.id, current.id))
      .returning();

    // Update categories if supplied
    if (data.categoryIds !== undefined) {
      await db.delete(artistCategories).where(eq(artistCategories.artistId, current.id));
      if (data.categoryIds.length > 0) {
        await db.insert(artistCategories).values(
          data.categoryIds.map((catId) => ({
            artistId: current.id,
            categoryId: catId,
          }))
        );
      }
    }

    return await this.getOrCreateDraftProfile(userId);
  }

  async submitProfileForReview(userId: string) {
    const profile = await this.getOrCreateDraftProfile(userId);

    if (profile.publicationState === "published") {
      throw new AppError(400, "BAD_REQUEST", "Profile is already published.");
    }

    const [updated] = await db
      .update(artistProfiles)
      .set({
        publicationState: "pending_review",
        updatedAt: new Date(),
      })
      .where(eq(artistProfiles.id, profile.id))
      .returning();

    return updated;
  }

  // ==========================================
  // Artist Packages (CRUD with Ownership Checks)
  // ==========================================

  async listOwnPackages(userId: string) {
    const profile = await this.getOrCreateDraftProfile(userId);
    return await db
      .select()
      .from(artistPackages)
      .where(and(eq(artistPackages.artistId, profile.id), eq(artistPackages.isActive, true)));
  }

  async createPackage(
    userId: string,
    pkg: {
      title: string;
      description?: string;
      durationMinutes: number;
      capacity?: number;
      feeMinor: number;
      currency?: string;
    }
  ) {
    const profile = await this.getOrCreateDraftProfile(userId);

    const [created] = await db
      .insert(artistPackages)
      .values({
        artistId: profile.id,
        title: pkg.title,
        description: pkg.description,
        durationMinutes: pkg.durationMinutes,
        capacity: pkg.capacity,
        feeMinor: pkg.feeMinor,
        currency: pkg.currency || "INR",
        isActive: true,
      })
      .returning();

    return created;
  }

  async updatePackage(
    userId: string,
    packageId: string,
    updates: {
      title?: string;
      description?: string;
      durationMinutes?: number;
      capacity?: number;
      feeMinor?: number;
      currency?: string;
    }
  ) {
    const profile = await this.getOrCreateDraftProfile(userId);

    // Strict ownership verification
    const [existing] = await db
      .select()
      .from(artistPackages)
      .where(and(eq(artistPackages.id, packageId), eq(artistPackages.artistId, profile.id)))
      .limit(1);

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Package not found or access denied.");
    }

    const [updated] = await db
      .update(artistPackages)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(artistPackages.id, packageId))
      .returning();

    return updated;
  }

  async archivePackage(userId: string, packageId: string) {
    const profile = await this.getOrCreateDraftProfile(userId);

    const [existing] = await db
      .select()
      .from(artistPackages)
      .where(and(eq(artistPackages.id, packageId), eq(artistPackages.artistId, profile.id)))
      .limit(1);

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Package not found or access denied.");
    }

    // Soft delete to preserve historical quote references
    await db
      .update(artistPackages)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(artistPackages.id, packageId));

    return { success: true };
  }

  // ==========================================
  // Media Uploads
  // ==========================================

  async createMediaUploadIntent(
    userId: string,
    data: { fileName: string; contentType: string; sizeBytes: number }
  ) {
    const storage = getStorageAdapter();
    const ext = data.fileName.split(".").pop() || "jpg";
    const storageKey = `uploads/${userId}/${randomUUID()}.${ext}`;

    const intent = await storage.createUploadIntent(storageKey, data.contentType, data.sizeBytes);

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        ownerId: userId,
        storageKey,
        url: storage.getPublicUrl(storageKey),
        mediaType: "image",
        scanState: "pending",
        visibility: "public",
      })
      .returning();

    return {
      assetId: asset.id,
      uploadUrl: intent.uploadUrl,
      storageKey: intent.storageKey,
      expiresInSeconds: intent.expiresInSeconds,
    };
  }

  async completeMediaUpload(userId: string, assetId: string) {
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.ownerId, userId)))
      .limit(1);

    if (!asset) {
      throw new AppError(404, "NOT_FOUND", "Media upload intent not found.");
    }

    const storage = getStorageAdapter();
    const verified = await storage.verifyObject(asset.storageKey);
    if (!verified) {
      throw new AppError(400, "BAD_REQUEST", "Uploaded object was not found in storage.");
    }

    const [updated] = await db
      .update(mediaAssets)
      .set({
        scanState: "clean",
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, asset.id))
      .returning();

    return updated;
  }
}

export const artistManagementService = new ArtistManagementService();
