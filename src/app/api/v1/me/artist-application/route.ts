import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const application = await artistManagementService.getOwnApplication(context.user.id);
    return createSuccessResponse(application, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
