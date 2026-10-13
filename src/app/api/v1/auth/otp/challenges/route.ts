import { NextRequest } from "next/server";
import { z } from "zod";
import { identityService } from "@/server/modules/identity/identityService";
import { getRequestId, parseJsonBody } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";

const requestOtpSchema = z
  .object({
    phone: z.string().min(1, "Phone number is required."),
  })
  .strict();

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const body = await parseJsonBody(req, requestOtpSchema);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const deviceId = req.headers.get("x-device-id") || undefined;

    const result = await identityService.requestOtp({
      phone: body.phone,
      ip: clientIp,
      deviceId,
    });

    return createSuccessResponse(
      {
        challengeId: result.challengeId,
        expiresInSeconds: result.expiresInSeconds,
        resendCooldownSeconds: result.resendCooldownSeconds,
      },
      requestId,
      201
    );
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
