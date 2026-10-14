import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId, parseQueryParams } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { shortlistService } from "@/server/modules/shortlist/shortlistService";
import { shortlistQuerySchema } from "@/server/modules/shortlist/schemas";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const query = parseQueryParams(req, shortlistQuerySchema);

    const result = await shortlistService.listShortlist(context.user.id, query.limit, query.cursor);
    return createSuccessResponse(result, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
