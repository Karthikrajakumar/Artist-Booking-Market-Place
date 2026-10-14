import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { shortlistService } from "@/server/modules/shortlist/shortlistService";
import { db } from "@/server/db";
import { users, artistProfiles } from "@/server/db/schema";
import { AppError } from "@/server/api/envelope";

describe("Shortlist Service Unit Tests", () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  it("checks status, saves idempotently, rejects non-existent artist, and removes", async () => {
    const [customer] = await db
      .insert(users)
      .values({ phone: "+919876543230", name: "Shortlist Customer" })
      .returning();

    const [artistUser] = await db
      .insert(users)
      .values({ phone: "+919876543231", name: "Artist User" })
      .returning();

    const [artist] = await db
      .insert(artistProfiles)
      .values({
        userId: artistUser.id,
        slug: "cool-band",
        stageName: "Cool Band",
        publicationState: "published",
      })
      .returning();

    // 1. Initial status: false
    const initStatus = await shortlistService.isShortlisted(customer.id, artist.id);
    expect(initStatus).toBe(false);

    // 2. Save artist
    const saveRes1 = await shortlistService.saveArtist(customer.id, artist.id);
    expect(saveRes1.isShortlisted).toBe(true);
    expect(saveRes1.id).toBeDefined();

    // 3. Status is now true
    const updatedStatus = await shortlistService.isShortlisted(customer.id, artist.id);
    expect(updatedStatus).toBe(true);

    // 4. Idempotent save
    const saveRes2 = await shortlistService.saveArtist(customer.id, artist.id);
    expect(saveRes2.isShortlisted).toBe(true);
    expect(saveRes2.id).toBe(saveRes1.id);

    // 5. Reject saving non-existent artist
    await expect(
      shortlistService.saveArtist(customer.id, "00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow(AppError);

    // 6. Remove artist
    const removeRes = await shortlistService.removeArtist(customer.id, artist.id);
    expect(removeRes.isShortlisted).toBe(false);

    const finalStatus = await shortlistService.isShortlisted(customer.id, artist.id);
    expect(finalStatus).toBe(false);
  });

  it("lists shortlisted artists with cursor pagination", async () => {
    const [customer] = await db
      .insert(users)
      .values({ phone: "+919876543232", name: "Pagination Customer" })
      .returning();

    // Create 3 artists
    const artistIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const [u] = await db
        .insert(users)
        .values({ phone: `+91987654323${i + 2}`, name: `Artist ${i}` })
        .returning();

      const [a] = await db
        .insert(artistProfiles)
        .values({
          userId: u.id,
          slug: `artist-${i}`,
          stageName: `Artist ${i}`,
          publicationState: "published",
        })
        .returning();

      artistIds.push(a.id);
      await shortlistService.saveArtist(customer.id, a.id);
    }

    // Page 1: limit = 2
    const page1 = await shortlistService.listShortlist(customer.id, 2);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    // Page 2: limit = 2 with cursor
    const page2 = await shortlistService.listShortlist(customer.id, 2, page1.nextCursor!);
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });
});
