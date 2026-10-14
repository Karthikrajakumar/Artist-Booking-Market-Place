import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId, parseJsonBody } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { artistManagementService } from "@/server/modules/artist-management/artistProfileService";
import { createPackageSchema } from "@/server/modules/artist-management/schemas";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const packages = await artistManagementService.listOwnPackages(context.user.id);
    return createSuccessResponse(packages, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const body = await parseJsonBody(req, createPackageSchema);

    const created = await artistManagementService.createPackage(context.user.id, body);
    return createSuccessResponse(created, requestId, 201);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
