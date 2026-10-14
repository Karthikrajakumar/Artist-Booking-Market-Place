import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId, parseJsonBody } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";
import { updatePackageSchema } from "@/server/modules/artist-management/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const { id } = await params;
    const body = await parseJsonBody(req, updatePackageSchema);

    const updated = await artistManagementService.updatePackage(context.user.id, id, body);
    return createSuccessResponse(updated, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const { id } = await params;

    const result = await artistManagementService.archivePackage(context.user.id, id);
    return createSuccessResponse(result, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
