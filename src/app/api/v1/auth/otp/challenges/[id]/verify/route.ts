import { NextRequest } from "next/server";
import { z } from "zod";
import { identityService } from "@/server/modules/identity/identityService";
import { sessionService } from "@/server/auth/session";
import { SESSION_COOKIE_NAME } from "@/server/auth/middleware";
import { getRequestId, parseJsonBody } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { config } from "@/server/config";

const verifyOtpSchema = z
  .object({
    code: z.string().min(4).max(10),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const { id } = await params;
    const body = await parseJsonBody(req, verifyOtpSchema);

    // 1. Verify OTP challenge
    const userResult = await identityService.verifyOtp(id, body.code);

    // 2. Create session
    const sessionResult = await sessionService.createSession(userResult.userId);

    // 3. Create success response
    const response = createSuccessResponse(
      {
        user: {
          id: userResult.userId,
          phone: userResult.phone,
          name: userResult.name,
          status: userResult.status,
          memberships: userResult.memberships,
        },
        csrfToken: sessionResult.csrfToken,
        isNewUser: userResult.isNewUser,
      },
      requestId,
      200
    );

    // 4. Set Secure, HttpOnly, SameSite=Lax, Path=/ cookie
    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionResult.token,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: config.SESSION_ABSOLUTE_EXPIRY_SECONDS,
    });

    return response;
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
