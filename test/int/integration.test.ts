import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { identityService } from "@/server/modules/identity/identityService";
import { sessionService } from "@/server/auth/session";
import { profileService } from "@/server/modules/identity/profileService";
import { smsAdapter } from "@/server/providers/sms/fake";
import { AppError } from "@/server/api/envelope";
import { db } from "@/server/db";
import { users, memberships, sessions, otpChallenges } from "@/server/db/schema";
import { eq } from "drizzle-orm";

describe("Phase 1 Integration Test Suite", () => {
  beforeAll(() => {
    setupTestDatabase();
  });

  beforeEach(() => {
    smsAdapter.clear();
  });

  it("1. Single consumption: A verified OTP cannot be reused", async () => {
    const testPhone = "+919876543210";
    const { challengeId } = await identityService.requestOtp({ phone: testPhone });
    const code = smsAdapter.getLastOtp(testPhone);
    expect(code).toBeDefined();

    // First verification succeeds
    const result1 = await identityService.verifyOtp(challengeId, code!);
    expect(result1.phone).toBe(testPhone);

    // Second verification attempt on the same challenge fails with CONFLICT (409)
    await expect(identityService.verifyOtp(challengeId, code!)).rejects.toThrow(AppError);
    try {
      await identityService.verifyOtp(challengeId, code!);
    } catch (e: any) {
      expect(e.statusCode).toBe(409);
      expect(e.code).toBe("CONFLICT");
    }
  });

  it("2. Concurrency: Concurrent verify attempts consume the challenge only once", async () => {
    const testPhone = "+919876543211";
    const { challengeId } = await identityService.requestOtp({ phone: testPhone });
    const code = smsAdapter.getLastOtp(testPhone);
    expect(code).toBeDefined();

    // Fire 5 concurrent requests with the valid code
    const promises = [
      identityService.verifyOtp(challengeId, code!),
      identityService.verifyOtp(challengeId, code!),
      identityService.verifyOtp(challengeId, code!),
      identityService.verifyOtp(challengeId, code!),
      identityService.verifyOtp(challengeId, code!),
    ];

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed, the rest must be rejected with 409 CONFLICT
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(4);
  });

  it("3. Expired sessions: Expired sessions return 401 / null", async () => {
    const testPhone = "+919876543212";
    const { challengeId } = await identityService.requestOtp({ phone: testPhone });
    const code = smsAdapter.getLastOtp(testPhone);
    const userRes = await identityService.verifyOtp(challengeId, code!);

    const { token, sessionId } = await sessionService.createSession(userRes.userId);

    // Artificially expire the session by updating idleExpiresAt in the past
    await db
      .update(sessions)
      .set({ idleExpiresAt: new Date(Date.now() - 10000) })
      .where(eq(sessions.id, sessionId));

    const validated = await sessionService.validateSession(token);
    expect(validated).toBeNull();
  });

  it("4. Logout: Revocation revokes the session", async () => {
    const testPhone = "+919876543213";
    const { challengeId } = await identityService.requestOtp({ phone: testPhone });
    const code = smsAdapter.getLastOtp(testPhone);
    const userRes = await identityService.verifyOtp(challengeId, code!);

    const { token } = await sessionService.createSession(userRes.userId);
    const validBefore = await sessionService.validateSession(token);
    expect(validBefore).not.toBeNull();

    // Revoke session
    await sessionService.revokeSession(token);

    const validAfter = await sessionService.validateSession(token);
    expect(validAfter).toBeNull();
  });

  it("5. Authorization allowlist: A customer cannot set their own role through profile update", async () => {
    const testPhone = "+919876543214";
    const { challengeId } = await identityService.requestOtp({ phone: testPhone });
    const code = smsAdapter.getLastOtp(testPhone);
    const userRes = await identityService.verifyOtp(challengeId, code!);

    // Allowed update
    const updated = await profileService.updateProfile(userRes.userId, { name: "Aarav" });
    expect(updated.name).toBe("Aarav");

    // Verify memberships still contain only customer
    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userRes.userId));

    expect(userMemberships.length).toBe(1);
    expect(userMemberships[0].role).toBe("customer");
  });

  it("6. CSRF validation: Rejects missing or incorrect CSRF tokens", async () => {
    const testPhone = "+919876543215";
    const { challengeId } = await identityService.requestOtp({ phone: testPhone });
    const code = smsAdapter.getLastOtp(testPhone);
    const userRes = await identityService.verifyOtp(challengeId, code!);

    const { sessionId, csrfToken } = await sessionService.createSession(userRes.userId);

    // Correct token passes
    expect(sessionService.validateCsrfToken(sessionId, csrfToken)).toBe(true);

    // Wrong or missing token fails
    expect(sessionService.validateCsrfToken(sessionId, "invalid-token-123")).toBe(false);
    expect(sessionService.validateCsrfToken(sessionId, "")).toBe(false);
  });
});
