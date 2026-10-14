import "server-only";
import { z } from "zod";

export const artistApplicationSchema = z
  .object({
    notes: z.string().max(1000).optional(),
  })
  .strict();

export const updateArtistProfileSchema = z
  .object({
    stageName: z.string().min(1).max(150).optional(),
    tagline: z.string().max(255).optional(),
    bio: z.string().max(5000).optional(),
    cityId: z.string().max(50).optional(),
    startingPriceMinor: z.number().int().nonnegative().optional(),
    experienceYears: z.number().int().min(0).max(75).optional(),
    coverImageUrl: z.string().url().optional(),
    categoryIds: z.array(z.string()).max(10).optional(),
  })
  .strict();

export const createPackageSchema = z
  .object({
    title: z.string().min(1).max(150),
    description: z.string().max(2000).optional(),
    durationMinutes: z.number().int().positive(),
    capacity: z.number().int().positive().optional(),
    feeMinor: z.number().int().nonnegative(),
    currency: z.string().length(3).default("INR"),
  })
  .strict();

export const updatePackageSchema = z
  .object({
    title: z.string().min(1).max(150).optional(),
    description: z.string().max(2000).optional(),
    durationMinutes: z.number().int().positive().optional(),
    capacity: z.number().int().positive().optional(),
    feeMinor: z.number().int().nonnegative().optional(),
    currency: z.string().length(3).optional(),
  })
  .strict();

export const createMediaUploadSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z.number().int().positive().max(5 * 1024 * 1024), // 5MB limit
  })
  .strict();
