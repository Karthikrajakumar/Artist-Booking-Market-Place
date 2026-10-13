import { describe, it, expect } from "vitest";
import { parseConfig } from "@/server/config";

describe("Environment Configuration Fail-Fast Tests", () => {
  const validBaseEnv = {
    DATABASE_URL: "postgresql://ind64:password@localhost:5433/ind64_test",
    OTP_HMAC_SECRET: "ind64_super_secret_otp_hmac_key_at_least_32_chars",
    SESSION_SECRET: "ind64_super_secret_session_encryption_key_32_chars",
    NODE_ENV: "test",
  };

  it("succeeds with complete and valid environment", () => {
    const parsed = parseConfig(validBaseEnv);
    expect(parsed.DATABASE_URL).toBe(validBaseEnv.DATABASE_URL);
  });

  it("fails fast when DATABASE_URL is missing or invalid URL", () => {
    const invalidEnv = { ...validBaseEnv, DATABASE_URL: "not_a_valid_url" };
    expect(() => parseConfig(invalidEnv)).toThrowError(/DATABASE_URL/);

    const missingEnv = { ...validBaseEnv };
    delete (missingEnv as any).DATABASE_URL;
    expect(() => parseConfig(missingEnv)).toThrowError(/DATABASE_URL/);
  });

  it("fails fast when OTP_HMAC_SECRET is missing or less than 32 characters", () => {
    const shortEnv = { ...validBaseEnv, OTP_HMAC_SECRET: "short_secret_only_24_ch" };
    expect(() => parseConfig(shortEnv)).toThrowError(/OTP_HMAC_SECRET must be at least 32 characters/);

    const missingEnv = { ...validBaseEnv };
    delete (missingEnv as any).OTP_HMAC_SECRET;
    expect(() => parseConfig(missingEnv)).toThrowError(/OTP_HMAC_SECRET/);
  });

  it("fails fast when SESSION_SECRET is missing or less than 32 characters", () => {
    const shortEnv = { ...validBaseEnv, SESSION_SECRET: "short_secret" };
    expect(() => parseConfig(shortEnv)).toThrowError(/SESSION_SECRET must be at least 32 characters/);

    const missingEnv = { ...validBaseEnv };
    delete (missingEnv as any).SESSION_SECRET;
    expect(() => parseConfig(missingEnv)).toThrowError(/SESSION_SECRET/);
  });
});
