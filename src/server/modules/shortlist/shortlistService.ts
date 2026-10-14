import "server-only";
import { db } from "../../db";
import { shortlistItems, artistProfiles } from "../../db/schema";
import { eq, and, sql, desc, or } from "drizzle-orm";
import { AppError } from "../../api/envelope";

export class ShortlistService {
  async isShortlisted(customerId: string, artistId: string): Promise<boolean> {
    const [item] = await db
      .select({ id: shortlistItems.id })
      .from(shortlistItems)
      .where(and(eq(shortlistItems.customerId, customerId), eq(shortlistItems.artistId, artistId)))
      .limit(1);

    return Boolean(item);
  }

  async saveArtist(customerId: string, artistId: string) {
    // Verify artist exists
    const [artist] = await db
      .select({ id: artistProfiles.id })
      .from(artistProfiles)
      .where(eq(artistProfiles.id, artistId))
      .limit(1);

    if (!artist) {
      throw new AppError(404, "NOT_FOUND", "Artist not found.");
    }

    // Idempotent insert: on conflict do nothing
    const [existing] = await db
      .select()
      .from(shortlistItems)
      .where(and(eq(shortlistItems.customerId, customerId), eq(shortlistItems.artistId, artistId)))
      .limit(1);

    if (existing) {
      return { isShortlisted: true, id: existing.id };
    }

    const [item] = await db
      .insert(shortlistItems)
      .values({
        customerId,
        artistId,
      })
      .returning();

    return { isShortlisted: true, id: item.id };
  }

  async removeArtist(customerId: string, artistId: string) {
    await db
      .delete(shortlistItems)
      .where(and(eq(shortlistItems.customerId, customerId), eq(shortlistItems.artistId, artistId)));

    return { isShortlisted: false };
  }

  async listShortlist(customerId: string, limit = 20, cursor?: string) {
    const conditions = [eq(shortlistItems.customerId, customerId)];

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, "base64").toString("utf-8");
        const lastColon = decoded.lastIndexOf(":");
        if (lastColon !== -1) {
          const cursorDateStr = decoded.substring(0, lastColon);
          const cursorId = decoded.substring(lastColon + 1);
          const cursorDate = new Date(cursorDateStr);
          if (!isNaN(cursorDate.getTime()) && cursorId) {
            conditions.push(
              or(
                sql`${shortlistItems.createdAt} < ${cursorDate}`,
                and(
                  sql`${shortlistItems.createdAt} = ${cursorDate}`,
                  sql`${shortlistItems.id} < ${cursorId}::uuid`
                )
              )!
            );
          }
        }
      } catch {
        // Ignore invalid cursor
      }
    }

    const items = await db
      .select({
        id: shortlistItems.id,
        createdAt: shortlistItems.createdAt,
        artist: {
          id: artistProfiles.id,
          slug: artistProfiles.slug,
          stageName: artistProfiles.stageName,
          tagline: artistProfiles.tagline,
          coverImageUrl: artistProfiles.coverImageUrl,
          startingPriceMinor: artistProfiles.startingPriceMinor,
          currency: artistProfiles.currency,
        },
      })
      .from(shortlistItems)
      .innerJoin(artistProfiles, eq(shortlistItems.artistId, artistProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(shortlistItems.createdAt), desc(shortlistItems.id))
      .limit(limit + 1);

    const hasNext = items.length > limit;
    const paginated = hasNext ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasNext && paginated.length > 0) {
      const last = paginated[paginated.length - 1];
      const raw = `${last.createdAt.toISOString()}:${last.id}`;
      nextCursor = Buffer.from(raw).toString("base64");
    }

    return { items: paginated, nextCursor };
  }
}

export const shortlistService = new ShortlistService();
