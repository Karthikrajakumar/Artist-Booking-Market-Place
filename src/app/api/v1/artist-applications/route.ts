import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId, parseJsonBody } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";
import { artistApplicationSchema } from "@/server/modules/artist-management/schemas";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const body = await parseJsonBody(req, artistApplicationSchema);

    const application = await artistManagementService.submitApplication(context.user.id, body.notes);
    return createSuccessResponse(application, requestId, 201);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
