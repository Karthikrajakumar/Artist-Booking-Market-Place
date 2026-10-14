import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId, parseJsonBody } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";
import { updateArtistProfileSchema } from "@/server/modules/artist-management/schemas";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const profile = await artistManagementService.getOrCreateDraftProfile(context.user.id);
    return createSuccessResponse(profile, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const body = await parseJsonBody(req, updateArtistProfileSchema);

    const updated = await artistManagementService.updateDraftProfile(context.user.id, body);
    return createSuccessResponse(updated, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
