import { describe, it, expect } from "vitest";
import { updateProfileSchema } from "@/server/modules/identity/profileService";
import { ZodError } from "zod";

describe("Allowlist in PATCH /me update schema", () => {
  it("accepts valid allowlisted fields (name)", () => {
    const result = updateProfileSchema.safeParse({ name: "Aarav Sharma" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Aarav Sharma");
    }
  });

  it("strictly rejects unknown or privileged fields (e.g. role, status, phone)", () => {
    // Attempting role elevation
    const roleAttempt = updateProfileSchema.safeParse({ name: "Aarav", role: "administrator" });
    expect(roleAttempt.success).toBe(false);

    // Attempting direct status change
    const statusAttempt = updateProfileSchema.safeParse({ status: "suspended" });
    expect(statusAttempt.success).toBe(false);

    // Attempting phone change via PATCH /me
    const phoneAttempt = updateProfileSchema.safeParse({ phone: "+919999999999" });
    expect(phoneAttempt.success).toBe(false);
  });
});
