import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { profileService, updateProfileSchema } from "@/server/modules/identity/profileService";
import { getRequestId, parseJsonBody } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);

    return createSuccessResponse(
      {
        id: context.user.id,
        phone: context.user.phone,
        name: context.user.name,
        status: context.user.status,
        memberships: context.user.memberships,
      },
      requestId,
      200
    );
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    // Strict schema parse ensures only allowlisted fields (e.g. name) are accepted, rejecting role/status
    const body = await parseJsonBody(req, updateProfileSchema);

    const updatedUser = await profileService.updateProfile(context.user.id, body);

    return createSuccessResponse(
      {
        ...updatedUser,
        memberships: context.user.memberships,
      },
      requestId,
      200
    );
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
