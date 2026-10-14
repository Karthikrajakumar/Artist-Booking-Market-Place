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
import { eq, and, sql, desc, asc, gte, lte, or, ilike, inArray } from "drizzle-orm";
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

    // Text search on stageName and tagline
    if (query.q) {
      conditions.push(
        or(
          ilike(artistProfiles.stageName, `%${query.q}%`),
          ilike(artistProfiles.tagline, `%${query.q}%`)
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

    // Decode cursor if provided: base64(createdAt:id)
    if (query.cursor) {
      try {
        const decoded = Buffer.from(query.cursor, "base64").toString("utf-8");
        const lastColon = decoded.lastIndexOf(":");
        if (lastColon !== -1) {
          const cursorDateStr = decoded.substring(0, lastColon);
          const cursorId = decoded.substring(lastColon + 1);
          const cursorDate = new Date(cursorDateStr);
          if (!isNaN(cursorDate.getTime()) && cursorId) {
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
        }
      } catch {
        // Ignore invalid cursor
      }
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
    const [profile] = await db
      .select()
      .from(artistProfiles)
      .where(and(eq(artistProfiles.slug, slug), eq(artistProfiles.publicationState, "published")))
      .limit(1);

    if (!profile) {
      throw new AppError(404, "NOT_FOUND", "Artist not found.");
    }

    // Fetch active packages
    const packages = await db
      .select()
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

    // Fetch approved public media
    const media = await db
      .select({
        id: mediaAssets.id,
        url: mediaAssets.url,
        mediaType: mediaAssets.mediaType,
      })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.ownerId, profile.userId),
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
