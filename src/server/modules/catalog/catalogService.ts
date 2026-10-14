import "server-only";
import { db } from "../../db";
import {
  categories,
  locations,
  artistProfiles,
  artistCategories,
  artistPackages,
  mediaAssets,
} from "../../db/schema";
import { eq, and, sql, desc, gte, lte, or, ilike, inArray } from "drizzle-orm";
import { ArtistSearchQuery } from "./schemas";
import { AppError } from "../../api/envelope";

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export class CatalogService {
  async listCategories() {
    return await db
      .select({
        id: categories.id,
        name: categories.name,
        description: categories.description,
      })
      .from(categories)
      .where(eq(categories.isActive, true));
  }

  async listLocations() {
    return await db
      .select({
        id: locations.id,
        name: locations.name,
        state: locations.state,
        country: locations.country,
      })
      .from(locations)
      .where(eq(locations.isActive, true));
  }

  /**
   * Escape LIKE/ILIKE metacharacters (%, _, and backslash) in user-supplied input.
   * pg ILIKE uses backslash as the default escape character.
   */
  private escapeLikePattern(raw: string): string {
    return raw
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
  }

  async searchArtists(query: ArtistSearchQuery): Promise<PaginatedResult<any>> {
    const conditions = [eq(artistProfiles.publicationState, "published")];

    // Filter by city
    if (query.city) {
      conditions.push(eq(artistProfiles.cityId, query.city));
    }

    // Filter by price range
    if (query.minPriceMinor !== undefined) {
      conditions.push(gte(artistProfiles.startingPriceMinor, query.minPriceMinor));
    }
    if (query.maxPriceMinor !== undefined) {
      conditions.push(lte(artistProfiles.startingPriceMinor, query.maxPriceMinor));
    }

    // Text search on stageName and tagline — escape LIKE metacharacters first
    if (query.q) {
      const pattern = `%${this.escapeLikePattern(query.q)}%`;
      conditions.push(
        or(
          ilike(artistProfiles.stageName, pattern),
          ilike(artistProfiles.tagline, pattern)
        )!
      );
    }

    // Filter by category slug if provided
    if (query.category) {
      const matchingArtists = await db
        .select({ artistId: artistCategories.artistId })
        .from(artistCategories)
        .where(eq(artistCategories.categoryId, query.category));

      const artistIds = matchingArtists.map((a) => a.artistId);
      if (artistIds.length === 0) {
        return { items: [], nextCursor: null };
      }
      conditions.push(inArray(artistProfiles.id, artistIds));
    }

    // Decode cursor if provided: base64(createdAt:id). Invalid cursors → 422.
    if (query.cursor) {
      let decoded: string;
      try {
        decoded = Buffer.from(query.cursor, "base64").toString("utf-8");
      } catch {
        throw new AppError(422, "UNPROCESSABLE_ENTITY", "Invalid pagination cursor.");
      }
      const lastColon = decoded.lastIndexOf(":");
      if (lastColon === -1) {
        throw new AppError(422, "UNPROCESSABLE_ENTITY", "Invalid pagination cursor.");
      }
      const cursorDateStr = decoded.substring(0, lastColon);
      const cursorId = decoded.substring(lastColon + 1);
      const cursorDate = new Date(cursorDateStr);
      if (isNaN(cursorDate.getTime()) || !cursorId) {
        throw new AppError(422, "UNPROCESSABLE_ENTITY", "Invalid pagination cursor.");
      }
      conditions.push(
        or(
          sql`${artistProfiles.createdAt} < ${cursorDate}`,
          and(
            sql`${artistProfiles.createdAt} = ${cursorDate}`,
            sql`${artistProfiles.id} < ${cursorId}::uuid`
          )
        )!
      );
    }

    const limit = query.limit ?? 20;
    // Fetch limit + 1 to check if there is a next page
    const artists = await db
      .select({
        id: artistProfiles.id,
        slug: artistProfiles.slug,
        stageName: artistProfiles.stageName,
        tagline: artistProfiles.tagline,
        cityId: artistProfiles.cityId,
        startingPriceMinor: artistProfiles.startingPriceMinor,
        currency: artistProfiles.currency,
        coverImageUrl: artistProfiles.coverImageUrl,
        createdAt: artistProfiles.createdAt,
      })
      .from(artistProfiles)
      .where(and(...conditions))
      .orderBy(desc(artistProfiles.createdAt), desc(artistProfiles.id))
      .limit(limit + 1);

    const hasNext = artists.length > limit;
    const items = hasNext ? artists.slice(0, limit) : artists;

    let nextCursor: string | null = null;
    if (hasNext && items.length > 0) {
      const lastItem = items[items.length - 1];
      const cursorStr = `${lastItem.createdAt.toISOString()}:${lastItem.id}`;
      nextCursor = Buffer.from(cursorStr).toString("base64");
    }

    return { items, nextCursor };
  }

  async getPublishedArtistBySlug(slug: string) {
    // Project only public fields — userId and storageKey are internal and must never be returned.
    const [profile] = await db
      .select({
        id: artistProfiles.id,
        slug: artistProfiles.slug,
        stageName: artistProfiles.stageName,
        tagline: artistProfiles.tagline,
        bio: artistProfiles.bio,
        cityId: artistProfiles.cityId,
        startingPriceMinor: artistProfiles.startingPriceMinor,
        currency: artistProfiles.currency,
        experienceYears: artistProfiles.experienceYears,
        coverImageUrl: artistProfiles.coverImageUrl,
        publicationState: artistProfiles.publicationState,
        createdAt: artistProfiles.createdAt,
        // userId intentionally excluded
      })
      .from(artistProfiles)
      .where(and(eq(artistProfiles.slug, slug), eq(artistProfiles.publicationState, "published")))
      .limit(1);

    if (!profile) {
      throw new AppError(404, "NOT_FOUND", "Artist not found.");
    }

    // Fetch active packages — internal artistId excluded from response
    const packages = await db
      .select({
        id: artistPackages.id,
        title: artistPackages.title,
        description: artistPackages.description,
        durationMinutes: artistPackages.durationMinutes,
        capacity: artistPackages.capacity,
        feeMinor: artistPackages.feeMinor,
        currency: artistPackages.currency,
      })
      .from(artistPackages)
      .where(and(eq(artistPackages.artistId, profile.id), eq(artistPackages.isActive, true)));

    // Fetch categories
    const categoriesList = await db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(artistCategories)
      .innerJoin(categories, eq(artistCategories.categoryId, categories.id))
      .where(eq(artistCategories.artistId, profile.id));

    // Fetch ONLY approved public media: scanState = 'clean' AND visibility = 'public'.
    // storageKey intentionally excluded — internal S3 path, never exposed to clients.
    const media = await db
      .select({
        id: mediaAssets.id,
        url: mediaAssets.url,
        mediaType: mediaAssets.mediaType,
      })
      .from(mediaAssets)
      .innerJoin(artistProfiles as any, eq(mediaAssets.ownerId, (artistProfiles as any).userId))
      .where(
        and(
          eq((artistProfiles as any).id, profile.id),
          eq(mediaAssets.scanState, "clean"),
          eq(mediaAssets.visibility, "public")
        )
      );

    return {
      ...profile,
      packages,
      categories: categoriesList,
      media,
    };
  }

  async getArtistAvailability(artistId: string) {
    const [profile] = await db
      .select({ id: artistProfiles.id, publicationState: artistProfiles.publicationState })
      .from(artistProfiles)
      .where(eq(artistProfiles.id, artistId))
      .limit(1);

    if (!profile || profile.publicationState !== "published") {
      throw new AppError(404, "NOT_FOUND", "Artist not found.");
    }

    // Public availability is advisory (Phase 2 returns available window notice)
    return {
      artistId: profile.id,
      isBookable: true,
      notice: "Coarse advisory availability. Final booking confirmed on accepted reservation.",
    };
  }
}

export const catalogService = new CatalogService();
