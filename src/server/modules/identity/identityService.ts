import "server-only";
import { db } from "../../db";
import { users, memberships, sessions, otpChallenges } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { config } from "../../config";
import { AppError } from "../../api/envelope";
import { normalizePhone } from "./phone";
import { generateOtpCode, computeOtpHmac, verifyOtpHmac } from "./crypto";
import { getSmsAdapter } from "../../providers/sms";
import { rateLimiter } from "./rateLimit";
import { randomUUID } from "node:crypto";

export interface RequestOtpParams {
  phone: string;
  ip?: string;
  deviceId?: string;
}

export interface RequestOtpResult {
  challengeId: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

export interface VerifyOtpResult {
  userId: string;
  phone: string;
  name: string | null;
  status: string;
  memberships: Array<{
    role: "customer" | "artist" | "administrator";
    approvalState: "pending" | "approved" | "rejected";
  }>;
  isNewUser: boolean;
}

export class IdentityService {
  /**
   * Request a new OTP challenge.
   * Throttles requests by phone, IP, and device ID.
   */
  async requestOtp(params: RequestOtpParams): Promise<RequestOtpResult> {
    const normalizedPhone = normalizePhone(params.phone);

    // Rate limiting: 5 requests per phone per hour, 20 per IP per hour, 10 per device per hour
    rateLimiter.checkLimit(`otp:phone:${normalizedPhone}`, 5, 3600);
    if (params.ip) {
      rateLimiter.checkLimit(`otp:ip:${params.ip}`, 20, 3600);
    }
    if (params.deviceId) {
      rateLimiter.checkLimit(`otp:device:${params.deviceId}`, 10, 3600);
    }

    const code = generateOtpCode();
    const codeHmac = computeOtpHmac(normalizedPhone, code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.OTP_EXPIRY_SECONDS * 1000);
    const resendAvailableAt = new Date(now.getTime() + config.OTP_RESEND_COOLDOWN_SECONDS * 1000);

    // Queue provider delivery
    const sms = getSmsAdapter();
    const sent = await sms.sendOtp(normalizedPhone, code);
    if (!sent) {
      throw new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "Unable to send verification code. Please try again in a moment."
      );
    }

    const [challenge] = await db
      .insert(otpChallenges)
      .values({
        phone: normalizedPhone,
        codeHmac,
        purpose: "login",
        expiresAt,
        maxAttempts: config.OTP_MAX_ATTEMPTS,
        attemptsUsed: 0,
        resendAvailableAt,
      })
      .returning();

    return {
      challengeId: challenge.id,
      expiresInSeconds: config.OTP_EXPIRY_SECONDS,
      resendCooldownSeconds: config.OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  /**
   * Resend an OTP for an existing challenge.
   * Invalidates previous code, issues a fresh code, and resets attempt counter.
   */
  async resendOtp(challengeId: string, clientIp?: string): Promise<RequestOtpResult> {
    if (clientIp) {
      rateLimiter.checkLimit(`otp:resend:ip:${clientIp}`, 10, 3600);
    }

    const [existing] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challengeId))
      .limit(1);

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Verification challenge not found.");
    }

    if (existing.consumedAt) {
      throw new AppError(400, "BAD_REQUEST", "Verification challenge has already been used.");
    }

    const now = new Date();
    if (now < existing.resendAvailableAt) {
      const waitSeconds = Math.ceil((existing.resendAvailableAt.getTime() - now.getTime()) / 1000);
      throw new AppError(
        429,
        "TOO_MANY_REQUESTS",
        `Please wait ${waitSeconds} seconds before requesting another code.`
      );
    }

    // Rate limit per phone
    rateLimiter.checkLimit(`otp:phone:${existing.phone}`, 5, 3600);

    const newCode = generateOtpCode();
    const newCodeHmac = computeOtpHmac(existing.phone, newCode);
    const expiresAt = new Date(now.getTime() + config.OTP_EXPIRY_SECONDS * 1000);
    const resendAvailableAt = new Date(now.getTime() + config.OTP_RESEND_COOLDOWN_SECONDS * 1000);

    const sms = getSmsAdapter();
    const sent = await sms.sendOtp(existing.phone, newCode);
    if (!sent) {
      throw new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "Unable to send verification code. Please try again in a moment."
      );
    }

    // Update challenge atomically with new code HMAC and reset attempts
    await db
      .update(otpChallenges)
      .set({
        codeHmac: newCodeHmac,
        expiresAt,
        resendAvailableAt,
        attemptsUsed: 0,
        updatedAt: now,
      })
      .where(eq(otpChallenges.id, challengeId));

    return {
      challengeId: existing.id,
      expiresInSeconds: config.OTP_EXPIRY_SECONDS,
      resendCooldownSeconds: config.OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  /**
   * Verify an OTP challenge atomically and create/resolve account.
   */
  async verifyOtp(challengeId: string, code: string): Promise<VerifyOtpResult> {
    const now = new Date();

    // 1. Fetch challenge
    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      throw new AppError(404, "NOT_FOUND", "Verification challenge not found.");
    }

    // 2. Check if already consumed
    if (challenge.consumedAt) {
      throw new AppError(409, "CONFLICT", "Verification code has already been used.");
    }

    // 3. Check expiration
    if (now > challenge.expiresAt) {
      throw new AppError(400, "OTP_EXPIRED", "Verification code has expired.");
    }

    // 4. Check attempts
    if (challenge.attemptsUsed >= challenge.maxAttempts) {
      throw new AppError(
        429,
        "OTP_MAX_ATTEMPTS_EXCEEDED",
        "Maximum verification attempts exceeded. Please request a new code."
      );
    }

    // 5. Verify HMAC
    const isValid = verifyOtpHmac(challenge.phone, code, challenge.codeHmac);

    if (!isValid) {
      // Increment attempts atomically
      await db
        .update(otpChallenges)
        .set({
          attemptsUsed: sql`${otpChallenges.attemptsUsed} + 1`,
          updatedAt: now,
        })
        .where(eq(otpChallenges.id, challengeId));

      const remaining = challenge.maxAttempts - (challenge.attemptsUsed + 1);
      if (remaining <= 0) {
        throw new AppError(
          429,
          "OTP_MAX_ATTEMPTS_EXCEEDED",
          "Maximum verification attempts exceeded. Please request a new code."
        );
      }

      throw new AppError(
        400,
        "INVALID_OTP",
        `Invalid verification code. ${remaining} attempts remaining.`
      );
    }

    // 6. Consume challenge atomically: update consumedAt where consumedAt IS NULL
    const updated = await db
      .update(otpChallenges)
      .set({
        consumedAt: now,
        attemptsUsed: sql`${otpChallenges.attemptsUsed} + 1`,
        updatedAt: now,
      })
      .where(and(eq(otpChallenges.id, challengeId), sql`${otpChallenges.consumedAt} IS NULL`))
      .returning();

    if (updated.length === 0) {
      // Race condition: another request consumed it concurrently
      throw new AppError(409, "CONFLICT", "Verification code has already been used.");
    }

    // 7. Resolve or create user account
    let isNewUser = false;
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, challenge.phone))
      .limit(1);

    if (!user) {
      isNewUser = true;
      const [newUser] = await db
        .insert(users)
        .values({
          phone: challenge.phone,
          status: "active",
        })
        .returning();
      user = newUser;

      // Assign default 'customer' role membership
      await db.insert(memberships).values({
        userId: user.id,
        role: "customer",
        approvalState: "approved",
      });
    }

    // Fetch memberships
    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));

    return {
      userId: user.id,
      phone: user.phone,
      name: user.name,
      status: user.status,
      memberships: userMemberships.map((m) => ({
        role: m.role,
        approvalState: m.approvalState,
      })),
      isNewUser,
    };
  }
}

export const identityService = new IdentityService();
