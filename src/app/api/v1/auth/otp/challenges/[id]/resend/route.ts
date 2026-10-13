import { NextRequest } from "next/server";
import { identityService } from "@/server/modules/identity/identityService";
import { getRequestId } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const { id } = await params;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const result = await identityService.resendOtp(id, clientIp);

    return createSuccessResponse(
      {
        challengeId: result.challengeId,
        expiresInSeconds: result.expiresInSeconds,
        resendCooldownSeconds: result.resendCooldownSeconds,
      },
      requestId,
      200
    );
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
