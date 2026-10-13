import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { config } from "../../config";

export function generateOtpCode(): string {
  // 6-digit numeric OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

export function computeOtpHmac(phone: string, code: string): string {
  return createHmac("sha256", config.OTP_HMAC_SECRET)
    .update(`${phone}:${code}`)
    .digest("hex");
}

export function verifyOtpHmac(phone: string, code: string, storedHmac: string): boolean {
  const calculated = computeOtpHmac(phone, code);
  return calculated === storedHmac;
}
