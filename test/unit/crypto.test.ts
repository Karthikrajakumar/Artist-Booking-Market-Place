import { describe, it, expect } from "vitest";
import { computeOtpHmac, verifyOtpHmac, generateOtpCode } from "@/server/modules/identity/crypto";

describe("OTP HMAC computation and verification", () => {
  it("generates a 6-digit numeric OTP code", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("produces deterministic HMAC for identical phone and code", () => {
    const phone = "+919876543210";
    const code = "123456";
    const hmac1 = computeOtpHmac(phone, code);
    const hmac2 = computeOtpHmac(phone, code);
    expect(hmac1).toBe(hmac2);
    expect(hmac1.length).toBe(64);
  });

  it("verifies valid HMAC and rejects invalid code or phone", () => {
    const phone = "+919876543210";
    const code = "654321";
    const hmac = computeOtpHmac(phone, code);

    expect(verifyOtpHmac(phone, code, hmac)).toBe(true);
    expect(verifyOtpHmac(phone, "654320", hmac)).toBe(false);
    expect(verifyOtpHmac("+919876543211", code, hmac)).toBe(false);
  });
});
