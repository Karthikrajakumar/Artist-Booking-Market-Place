import "server-only";
import { db } from "../db";
import { sessions, users, memberships } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { config } from "../config";
import { AppError } from "../api/envelope";

export interface AuthenticatedUser {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  memberships: Array<{
    role: "customer" | "artist" | "administrator";
    approvalState: "pending" | "approved" | "rejected";
  }>;
}

export interface SessionContext {
  user: AuthenticatedUser;
  sessionId: string;
  csrfToken: string;
}

export class SessionService {
  /**
   * Generates a high-entropy cryptographically secure random token (64 hex characters)
   */
  generateOpaqueToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Hashes token with SHA-256 (64 hex chars) before database storage
   */
  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Generates a session-bound CSRF token
   */
  generateCsrfToken(sessionId: string): string {
    return createHash("sha256")
      .update(`${sessionId}:${config.SESSION_SECRET}`)
      .digest("hex");
  }

  /**
   * Validates CSRF token
   */
  validateCsrfToken(sessionId: string, candidateToken: string): boolean {
    const expected = this.generateCsrfToken(sessionId);
    return expected === candidateToken;
  }

  /**
   * Create a new session for a user.
   * Enforces 7-day idle expiry and 30-day absolute expiry.
   */
  async createSession(userId: string): Promise<{ token: string; sessionId: string; csrfToken: string }> {
    const rawToken = this.generateOpaqueToken();
    const tokenHash = this.hashToken(rawToken);

    const now = new Date();
    const idleExpiresAt = new Date(now.getTime() + config.SESSION_IDLE_EXPIRY_SECONDS * 1000);
    const absoluteExpiresAt = new Date(now.getTime() + config.SESSION_ABSOLUTE_EXPIRY_SECONDS * 1000);

    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        tokenHash,
        idleExpiresAt,
        absoluteExpiresAt,
      })
      .returning();

    const csrfToken = this.generateCsrfToken(session.id);

    return {
      token: rawToken,
      sessionId: session.id,
      csrfToken,
    };
  }

  /**
   * Validates a session token from cookie, checking revocation, idle, and absolute expiries.
   * Refreshes idle expiration if valid.
   */
  async validateSession(rawToken: string): Promise<SessionContext | null> {
    if (!rawToken || typeof rawToken !== "string") {
      return null;
    }

    const tokenHash = this.hashToken(rawToken);
    const now = new Date();

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, tokenHash), sql`${sessions.revokedAt} IS NULL`))
      .limit(1);

    if (!session) {
      return null;
    }

    // Check absolute expiration
    if (now > session.absoluteExpiresAt) {
      return null;
    }

    // Check idle expiration
    if (now > session.idleExpiresAt) {
      return null;
    }

    // Refresh idle expiration
    const newIdleExpiresAt = new Date(now.getTime() + config.SESSION_IDLE_EXPIRY_SECONDS * 1000);
    await db
      .update(sessions)
      .set({
        idleExpiresAt: newIdleExpiresAt,
        updatedAt: now,
      })
      .where(eq(sessions.id, session.id));

    // Fetch user and memberships
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user || user.status !== "active") {
      return null;
    }

    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));

    const csrfToken = this.generateCsrfToken(session.id);

    return {
      sessionId: session.id,
      csrfToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        status: user.status,
        memberships: userMemberships.map((m) => ({
          role: m.role,
          approvalState: m.approvalState,
        })),
      },
    };
  }

  /**
   * Revoke a session by token
   */
  async revokeSession(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.tokenHash, tokenHash));
  }
}

export const sessionService = new SessionService();
