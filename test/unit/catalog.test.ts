import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { catalogService } from "@/server/modules/catalog/catalogService";
import { db } from "@/server/db";
import {
  users,
  locations,
  categories,
  artistProfiles,
  artistCategories,
  artistPackages,
  mediaAssets,
} from "@/server/db/schema";
import { AppError } from "@/server/api/envelope";

describe("Catalog Service Unit Tests", () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  it("lists active categories and locations", async () => {
    await db.insert(categories).values([
      { id: "vocalist", name: "Vocalist", description: "Singers", isActive: true },
      { id: "dj", name: "DJ", description: "DJs", isActive: true },
      { id: "inactive-cat", name: "Hidden", description: "Old", isActive: false },
    ]);

    await db.insert(locations).values([
      { id: "blr", name: "Bengaluru", state: "Karnataka", country: "IN", isActive: true },
      { id: "mum", name: "Mumbai", state: "Maharashtra", country: "IN", isActive: true },
      { id: "inactive-loc", name: "Hidden", state: "None", country: "IN", isActive: false },
    ]);

    const activeCats = await catalogService.listCategories();
    expect(activeCats).toHaveLength(2);
    expect(activeCats.map((c) => c.id).sort()).toEqual(["dj", "vocalist"]);

    const activeLocs = await catalogService.listLocations();
    expect(activeLocs).toHaveLength(2);
    expect(activeLocs.map((l) => l.id).sort()).toEqual(["blr", "mum"]);
  });

  it("searches published artists with filters and cursor pagination", async () => {
    // Insert location and categories
    await db.insert(locations).values([
      { id: "blr", name: "Bengaluru", state: "Karnataka", isActive: true },
      { id: "mum", name: "Mumbai", state: "Maharashtra", isActive: true },
    ]);
    await db.insert(categories).values([
      { id: "acoustic", name: "Acoustic", isActive: true },
      { id: "rock", name: "Rock", isActive: true },
    ]);

    // Insert users for artists
    const [user1] = await db
      .insert(users)
      .values({ phone: "+919876543210", name: "Rahul Owner" })
      .returning();
    const [user2] = await db
      .insert(users)
      .values({ phone: "+919876543211", name: "Ananya Owner" })
      .returning();
    const [user3] = await db
      .insert(users)
      .values({ phone: "+919876543212", name: "DJ Owner" })
      .returning();
    const [user4] = await db
      .insert(users)
      .values({ phone: "+919876543213", name: "Draft Owner" })
      .returning();

    // Insert 3 published artists and 1 draft artist
    const [artist1] = await db
      .insert(artistProfiles)
      .values({
        userId: user1.id,
        slug: "rahul-acoustic",
        stageName: "Rahul Acoustic",
        tagline: "Soulful acoustic guitarist",
        cityId: "blr",
        startingPriceMinor: 1000000, // 10,000 INR
        publicationState: "published",
      })
      .returning();

    const [artist2] = await db
      .insert(artistProfiles)
      .values({
        userId: user2.id,
        slug: "ananya-rock",
        stageName: "Ananya",
        tagline: "Rock and pop vocalist",
        cityId: "blr",
        startingPriceMinor: 2500000, // 25,000 INR
        publicationState: "published",
      })
      .returning();

    const [artist3] = await db
      .insert(artistProfiles)
      .values({
        userId: user3.id,
        slug: "mumbai-dj",
        stageName: "DJ Max",
        tagline: "EDM and Bollywood DJ",
        cityId: "mum",
        startingPriceMinor: 3000000, // 30,000 INR
        publicationState: "published",
      })
      .returning();

    await db.insert(artistProfiles).values({
      userId: user4.id,
      slug: "draft-artist",
      stageName: "Draft Performer",
      publicationState: "draft",
    });

    // Tag categories
    await db.insert(artistCategories).values([
      { artistId: artist1.id, categoryId: "acoustic" },
      { artistId: artist2.id, categoryId: "rock" },
    ]);

    // 1. Text search
    const textRes = await catalogService.searchArtists({ q: "acoustic", limit: 20 });
    expect(textRes.items).toHaveLength(1);
    expect(textRes.items[0].slug).toBe("rahul-acoustic");

    // 2. City filter
    const cityRes = await catalogService.searchArtists({ city: "mum", limit: 20 });
    expect(cityRes.items).toHaveLength(1);
    expect(cityRes.items[0].slug).toBe("mumbai-dj");

    // 3. Price filter
    const priceRes = await catalogService.searchArtists({
      minPriceMinor: 1500000,
      maxPriceMinor: 2800000,
      limit: 20,
    });
    expect(priceRes.items).toHaveLength(1);
    expect(priceRes.items[0].slug).toBe("ananya-rock");

    // 4. Category filter
    const catRes = await catalogService.searchArtists({ category: "acoustic", limit: 20 });
    expect(catRes.items).toHaveLength(1);
    expect(catRes.items[0].slug).toBe("rahul-acoustic");

    // 5. Pagination: limit = 2
    const page1 = await catalogService.searchArtists({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await catalogService.searchArtists({ limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });

  it("retrieves published artist by slug with packages, categories, and public media", async () => {
    const [user] = await db
      .insert(users)
      .values({ phone: "+919876543211", name: "Musician" })
      .returning();

    const [category] = await db
      .insert(categories)
      .values({ id: "classical", name: "Classical" })
      .returning();

    const [artist] = await db
      .insert(artistProfiles)
      .values({
        userId: user.id,
        slug: "vidya-classical",
        stageName: "Vidya",
        tagline: "Carnatic Vocalist",
        publicationState: "published",
      })
      .returning();

    await db.insert(artistCategories).values({
      artistId: artist.id,
      categoryId: category.id,
    });

    // Active package + inactive package
    await db.insert(artistPackages).values([
      {
        artistId: artist.id,
        title: "Concert 90 Mins",
        durationMinutes: 90,
        feeMinor: 5000000,
        isActive: true,
      },
      {
        artistId: artist.id,
        title: "Archived Package",
        durationMinutes: 60,
        feeMinor: 2000000,
        isActive: false,
      },
    ]);

    // Public clean media + private / unverified media
    await db.insert(mediaAssets).values([
      {
        ownerId: user.id,
        storageKey: "uploads/public.jpg",
        url: "https://storage.ind64.com/uploads/public.jpg",
        mediaType: "image",
        scanState: "clean",
        visibility: "public",
      },
      {
        ownerId: user.id,
        storageKey: "uploads/private.jpg",
        url: "https://storage.ind64.com/uploads/private.jpg",
        mediaType: "image",
        scanState: "clean",
        visibility: "private",
      },
    ]);

    const result = await catalogService.getPublishedArtistBySlug("vidya-classical");
    expect(result.stageName).toBe("Vidya");
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("Classical");
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].title).toBe("Concert 90 Mins");
    expect(result.media).toHaveLength(1);
    expect(result.media[0].url).toBe("https://storage.ind64.com/uploads/public.jpg");
  });

  it("throws 404 for unapproved/draft artist or non-existent slug", async () => {
    const [user] = await db.insert(users).values({ phone: "+919876543212" }).returning();
    await db.insert(artistProfiles).values({
      userId: user.id,
      slug: "pending-artist",
      stageName: "Pending Artist",
      publicationState: "pending_review",
    });

    await expect(catalogService.getPublishedArtistBySlug("pending-artist")).rejects.toThrow(
      AppError
    );
    await expect(catalogService.getPublishedArtistBySlug("non-existent-slug")).rejects.toThrow(
      AppError
    );
  });

  it("returns coarse advisory availability for published artist and 404 for draft", async () => {
    const [userPub] = await db.insert(users).values({ phone: "+919876543214" }).returning();
    const [userDraft] = await db.insert(users).values({ phone: "+919876543215" }).returning();
    const [pub] = await db
      .insert(artistProfiles)
      .values({
        userId: userPub.id,
        slug: "pub-artist",
        stageName: "Pub Artist",
        publicationState: "published",
      })
      .returning();

    const [draft] = await db
      .insert(artistProfiles)
      .values({
        userId: userDraft.id,
        slug: "draft-artist-2",
        stageName: "Draft Artist",
        publicationState: "draft",
      })
      .returning();

    const avail = await catalogService.getArtistAvailability(pub.id);
    expect(avail.artistId).toBe(pub.id);
    expect(avail.isBookable).toBe(true);

    await expect(catalogService.getArtistAvailability(draft.id)).rejects.toThrow(AppError);
  });
});
