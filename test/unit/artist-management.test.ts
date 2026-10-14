import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";
import { db } from "@/server/db";
import { users, categories, artistProfiles, artistPackages } from "@/server/db/schema";
import { AppError } from "@/server/api/envelope";

describe("Artist Management Service Unit Tests", () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  it("submits artist application, prevents duplicates, and retrieves own application", async () => {
    const [user] = await db
      .insert(users)
      .values({ phone: "+919876543220", name: "Aspiring Artist" })
      .returning();

    // 1. Submit application
    const app = await artistManagementService.submitApplication(user.id, "I have 5 years live experience.");
    expect(app.id).toBeDefined();
    expect(app.status).toBe("pending");
    expect(app.notes).toBe("I have 5 years live experience.");

    // 2. Reject duplicate pending application
    await expect(
      artistManagementService.submitApplication(user.id, "Another application attempt")
    ).rejects.toThrow(AppError);

    // 3. Retrieve own application
    const retrieved = await artistManagementService.getOwnApplication(user.id);
    expect(retrieved.id).toBe(app.id);
    expect(retrieved.status).toBe("pending");
  });

  it("auto-creates draft profile, updates details, and submits for review", async () => {
    const [user] = await db
      .insert(users)
      .values({ phone: "+919876543221", name: "Siddharth Roy" })
      .returning();

    await db.insert(categories).values([
      { id: "jazz", name: "Jazz" },
      { id: "blues", name: "Blues" },
    ]);

    // 1. Auto create / get draft profile
    const draft = await artistManagementService.getOrCreateDraftProfile(user.id);
    expect(draft.userId).toBe(user.id);
    expect(draft.publicationState).toBe("draft");
    expect(draft.slug).toContain("artist-");

    // 2. Update profile
    const updated = await artistManagementService.updateDraftProfile(user.id, {
      stageName: "Sid Roy & The Band",
      tagline: "Smooth jazz and classic blues",
      startingPriceMinor: 2000000,
      categoryIds: ["jazz", "blues"],
    });

    expect(updated.stageName).toBe("Sid Roy & The Band");
    expect(updated.slug).toContain("sid-roy-the-band");
    expect(updated.startingPriceMinor).toBe(2000000);
    expect(updated.categories).toHaveLength(2);

    // 3. Submit profile for review
    const submitted = await artistManagementService.submitProfileForReview(user.id);
    expect(submitted.publicationState).toBe("pending_review");
  });

  it("enforces package CRUD and cross-tenant ownership isolation", async () => {
    const [userA] = await db
      .insert(users)
      .values({ phone: "+919876543222", name: "User A" })
      .returning();
    const [userB] = await db
      .insert(users)
      .values({ phone: "+919876543223", name: "User B" })
      .returning();

    // User A creates package
    const pkgA = await artistManagementService.createPackage(userA.id, {
      title: "Wedding Set 60m",
      durationMinutes: 60,
      feeMinor: 4000000,
      currency: "INR",
    });
    expect(pkgA.id).toBeDefined();
    expect(pkgA.title).toBe("Wedding Set 60m");

    // User A lists packages
    const listA = await artistManagementService.listOwnPackages(userA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0].id).toBe(pkgA.id);

    // User B tries to update User A's package -> 404 / access denied
    await expect(
      artistManagementService.updatePackage(userB.id, pkgA.id, {
        title: "Malicious Edit",
      })
    ).rejects.toThrow(AppError);

    // User B tries to archive User A's package -> 404 / access denied
    await expect(artistManagementService.archivePackage(userB.id, pkgA.id)).rejects.toThrow(
      AppError
    );

    // User A updates own package
    const updatedPkg = await artistManagementService.updatePackage(userA.id, pkgA.id, {
      title: "Wedding Set 90m",
      durationMinutes: 90,
      feeMinor: 5500000,
    });
    expect(updatedPkg.title).toBe("Wedding Set 90m");
    expect(updatedPkg.durationMinutes).toBe(90);

    // User A archives own package (soft delete)
    const archiveResult = await artistManagementService.archivePackage(userA.id, pkgA.id);
    expect(archiveResult.success).toBe(true);

    // Package no longer shows up in active packages
    const listAfterArchive = await artistManagementService.listOwnPackages(userA.id);
    expect(listAfterArchive).toHaveLength(0);
  });
});
