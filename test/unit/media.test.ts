import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";
import { createMediaUploadSchema } from "@/server/modules/artist-management/schemas";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { getStorageAdapter } from "@/server/providers/storage";
import { AppError } from "@/server/api/envelope";

describe("Media Storage & Upload Service Unit Tests", () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  it("validates upload schema: rejects unsupported MIME and excessive file sizes", () => {
    // Valid
    expect(() =>
      createMediaUploadSchema.parse({
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1024 * 1024,
      })
    ).not.toThrow();

    // Invalid MIME
    expect(() =>
      createMediaUploadSchema.parse({
        fileName: "doc.pdf",
        contentType: "application/pdf" as any,
        sizeBytes: 1024,
      })
    ).toThrow();

    // Exceeds 5MB
    expect(() =>
      createMediaUploadSchema.parse({
        fileName: "giant.png",
        contentType: "image/png",
        sizeBytes: 6 * 1024 * 1024,
      })
    ).toThrow();
  });

  it("creates upload intent, simulates upload, and completes successfully", async () => {
    const [user] = await db
      .insert(users)
      .values({ phone: "+919876543240", name: "Media Owner" })
      .returning();

    // 1. Create upload intent
    const intent = await artistManagementService.createMediaUploadIntent(user.id, {
      fileName: "headshot.jpg",
      contentType: "image/jpeg",
      sizeBytes: 500000,
    });

    expect(intent.assetId).toBeDefined();
    expect(intent.uploadUrl).toBeDefined();
    expect(intent.storageKey).toContain(`uploads/${user.id}/`);

    // 2. Attempt complete before object is uploaded -> fails with 400
    await expect(
      artistManagementService.completeMediaUpload(user.id, intent.assetId)
    ).rejects.toThrow(AppError);

    // 3. Simulate object upload via FakeStorageAdapter
    const storage = getStorageAdapter();
    (storage as any).simulateUpload(intent.storageKey, Buffer.from("fake image data"));

    // 4. Complete upload -> succeeds and marks scanState clean
    const completed = await artistManagementService.completeMediaUpload(user.id, intent.assetId);
    expect(completed.id).toBe(intent.assetId);
    expect(completed.scanState).toBe("clean");
  });

  it("rejects completing upload intent owned by another user", async () => {
    const [user1] = await db.insert(users).values({ phone: "+919876543241" }).returning();
    const [user2] = await db.insert(users).values({ phone: "+919876543242" }).returning();

    const intent = await artistManagementService.createMediaUploadIntent(user1.id, {
      fileName: "promo.png",
      contentType: "image/png",
      sizeBytes: 100000,
    });

    // user2 tries to complete user1's upload
    await expect(
      artistManagementService.completeMediaUpload(user2.id, intent.assetId)
    ).rejects.toThrow(AppError);
  });
});
