import "server-only";
import { z } from "zod";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "../../api/envelope";

// Strict allowlist for PATCH /api/v1/me: only 'name' is editable
export const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export class ProfileService {
  async updateProfile(userId: string, input: UpdateProfileInput) {
    const [updated] = await db
      .update(users)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "User profile not found.");
    }

    return {
      id: updated.id,
      phone: updated.phone,
      name: updated.name,
      status: updated.status,
    };
  }
}

export const profileService = new ProfileService();
