import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { identityService } from "@/server/modules/identity/identityService";
import { sessionService } from "@/server/auth/session";
import { smsAdapter } from "@/server/providers/sms/fake";
import { GET } from "@/app/api/v1/auth/session/route";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/middleware";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

describe("HTTP-level Session Expiry & Error Envelope", () => {
  beforeEach(() => {
    setupTestDatabase();
    smsAdapter.clear();
  });

  it("returns HTTP 401 with standard error envelope when session is expired", async () => {
    const phone = "+919876543240";
    const { challengeId } = await identityService.requestOtp({ phone });
    const code = smsAdapter.getLastOtp(phone)!;
    const userRes = await identityService.verifyOtp(challengeId, code);

    const { token, sessionId } = await sessionService.createSession(userRes.userId);

    // Manually expire session
    await db
      .update(sessions)
      .set({ idleExpiresAt: new Date(Date.now() - 5000) })
      .where(eq(sessions.id, sessionId));

    const req = new NextRequest("http://localhost:3000/api/v1/auth/session", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
        "x-request-id": "req_expired_session_test",
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Session expired or invalid.",
        fields: [],
      },
      requestId: "req_expired_session_test",
    });
  });

  it("returns HTTP 401 with standard error envelope when session cookie is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/session", {
      headers: {
        "x-request-id": "req_missing_cookie_test",
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. No active session.",
        fields: [],
      },
      requestId: "req_missing_cookie_test",
    });
  });
});
