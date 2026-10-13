import { NextRequest } from "next/server";
import { requireAuth, SESSION_COOKIE_NAME } from "@/server/auth/middleware";
import { sessionService } from "@/server/auth/session";
import { getRequestId } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);

    return createSuccessResponse(
      {
        user: context.user,
        csrfToken: context.csrfToken,
        onboardingState: {
          hasCompletedProfile: Boolean(context.user.name),
        },
      },
      requestId,
      200
    );
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (rawToken) {
      await sessionService.revokeSession(rawToken);
    }

    const response = createSuccessResponse({ success: true }, requestId, 200);

    // Revoke and clear cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
