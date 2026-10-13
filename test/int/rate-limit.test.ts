import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { identityService } from "@/server/modules/identity/identityService";
import { rateLimiter } from "@/server/modules/identity/rateLimit";
import { AppError } from "@/server/api/envelope";

describe("Rate Limiting Integration Tests", () => {
  beforeEach(() => {
    setupTestDatabase();
    rateLimiter.reset();
  });

  it("enforces hourly limit per phone (5 requests / hour) returning 429", async () => {
    const phone = "+919876543230";

    // 5 allowed requests
    for (let i = 0; i < 5; i++) {
      await identityService.requestOtp({ phone });
    }

    // 6th request must throw 429
    await expect(identityService.requestOtp({ phone })).rejects.toThrow(AppError);
    try {
      await identityService.requestOtp({ phone });
    } catch (e: any) {
      expect(e.statusCode).toBe(429);
      expect(e.code).toBe("TOO_MANY_REQUESTS");
    }
  });

  it("enforces hourly limit per IP (20 requests / hour) across multiple phones", async () => {
    const clientIp = "192.168.1.100";

    // 20 requests using distinct phones on the same IP
    for (let i = 0; i < 20; i++) {
      const phone = `+9198765432${i < 10 ? "4" + i : "5" + (i - 10)}`;
      await identityService.requestOtp({ phone, ip: clientIp });
    }

    // 21st request on the same IP must be throttled
    const nextPhone = "+919876543299";
    await expect(identityService.requestOtp({ phone: nextPhone, ip: clientIp })).rejects.toThrow(
      AppError
    );
    try {
      await identityService.requestOtp({ phone: nextPhone, ip: clientIp });
    } catch (e: any) {
      expect(e.statusCode).toBe(429);
      expect(e.code).toBe("TOO_MANY_REQUESTS");
    }
  });

  it("enforces hourly limit per device (10 requests / hour) across different phones", async () => {
    const deviceId = "device_test_xyz_123";

    for (let i = 0; i < 10; i++) {
      const phone = `+9198765431${i < 10 ? "0" + i : i}`;
      await identityService.requestOtp({ phone, deviceId });
    }

    // 11th request on the same device must be throttled
    const nextPhone = "+919876543199";
    await expect(identityService.requestOtp({ phone: nextPhone, deviceId })).rejects.toThrow(
      AppError
    );
    try {
      await identityService.requestOtp({ phone: nextPhone, deviceId });
    } catch (e: any) {
      expect(e.statusCode).toBe(429);
      expect(e.code).toBe("TOO_MANY_REQUESTS");
    }
  });

  it("shares rate-limit state across requests until window expiration", () => {
    rateLimiter.checkLimit("test:shared:key", 2, 60);
    rateLimiter.checkLimit("test:shared:key", 2, 60);
    expect(() => rateLimiter.checkLimit("test:shared:key", 2, 60)).toThrow(AppError);
  });
});
