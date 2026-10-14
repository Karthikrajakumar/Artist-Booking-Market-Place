import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const { id } = await params;

    const completed = await artistManagementService.completeMediaUpload(context.user.id, id);
    return createSuccessResponse(completed, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
