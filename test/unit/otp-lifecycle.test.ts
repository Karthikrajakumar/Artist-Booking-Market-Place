import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { identityService } from "@/server/modules/identity/identityService";
import { smsAdapter } from "@/server/providers/sms/fake";
import { AppError } from "@/server/api/envelope";

describe("OTP Lifecycle & Attempt Lockout Unit Tests", () => {
  const phone = "+919876543220";

  beforeEach(() => {
    setupTestDatabase();
    smsAdapter.clear();
    // Do NOT fake timers globally (avoid faking setImmediate/process.nextTick needed by pg promises)
    // Instead fake only Date
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("expires OTP at exactly 5 minutes (300s)", async () => {
    const { challengeId } = await identityService.requestOtp({ phone });
    const code = smsAdapter.getLastOtp(phone)!;

    // Advance system time past 300 seconds
    vi.setSystemTime(new Date(Date.now() + 301 * 1000));

    await expect(identityService.verifyOtp(challengeId, code)).rejects.toThrow(AppError);
    try {
      await identityService.verifyOtp(challengeId, code);
    } catch (e: any) {
      expect(e.statusCode).toBe(400);
      expect(e.code).toBe("OTP_EXPIRED");
    }
  });

  it("locks the challenge after 5 failed attempts, and rejects the 6th attempt even with the correct code", async () => {
    const { challengeId } = await identityService.requestOtp({ phone: "+919876543221" });
    const correctCode = smsAdapter.getLastOtp("+919876543221")!;

    // 1st failed attempt
    await expect(identityService.verifyOtp(challengeId, "000000")).rejects.toThrow(AppError);
    // 2nd failed attempt
    await expect(identityService.verifyOtp(challengeId, "000000")).rejects.toThrow(AppError);
    // 3rd failed attempt
    await expect(identityService.verifyOtp(challengeId, "000000")).rejects.toThrow(AppError);
    // 4th failed attempt
    await expect(identityService.verifyOtp(challengeId, "000000")).rejects.toThrow(AppError);
    // 5th failed attempt -> locks the challenge
    try {
      await identityService.verifyOtp(challengeId, "000000");
    } catch (e: any) {
      expect(e.statusCode).toBe(429);
      expect(e.code).toBe("OTP_MAX_ATTEMPTS_EXCEEDED");
    }

    // 6th attempt WITH THE CORRECT CODE must be rejected with 429
    await expect(identityService.verifyOtp(challengeId, correctCode)).rejects.toThrow(AppError);
    try {
      await identityService.verifyOtp(challengeId, correctCode);
    } catch (e: any) {
      expect(e.statusCode).toBe(429);
      expect(e.code).toBe("OTP_MAX_ATTEMPTS_EXCEEDED");
    }
  });

  it("blocks resend within 60 seconds, and invalidates previous code upon successful resend", async () => {
    const { challengeId } = await identityService.requestOtp({ phone: "+919876543222" });
    const firstCode = smsAdapter.getLastOtp("+919876543222")!;

    // Advance 30 seconds -> Resend must be blocked
    vi.setSystemTime(new Date(Date.now() + 30 * 1000));
    await expect(identityService.resendOtp(challengeId)).rejects.toThrow(AppError);
    try {
      await identityService.resendOtp(challengeId);
    } catch (e: any) {
      expect(e.statusCode).toBe(429);
      expect(e.code).toBe("TOO_MANY_REQUESTS");
    }

    // Advance past 60 seconds (total 65s) -> Resend succeeds
    vi.setSystemTime(new Date(Date.now() + 35 * 1000));
    const resendResult = await identityService.resendOtp(challengeId);
    expect(resendResult.challengeId).toBe(challengeId);

    const secondCode = smsAdapter.getLastOtp("+919876543222")!;
    expect(secondCode).toBeDefined();

    // Previous code must be invalid
    await expect(identityService.verifyOtp(challengeId, firstCode)).rejects.toThrow(AppError);

    // New code verifies successfully
    const verified = await identityService.verifyOtp(challengeId, secondCode);
    expect(verified.phone).toBe("+919876543222");
  });
});
