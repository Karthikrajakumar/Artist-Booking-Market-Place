import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId, parseJsonBody } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";
import { createMediaUploadSchema } from "@/server/modules/artist-management/schemas";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const body = await parseJsonBody(req, createMediaUploadSchema);

    const intent = await artistManagementService.createMediaUploadIntent(context.user.id, body);
    return createSuccessResponse(intent, requestId, 201);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
