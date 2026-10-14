import { NextRequest } from "next/server";
import { getRequestId, parseQueryParams } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { catalogService } from "@/server/modules/catalog/catalogService";
import { artistSearchQuerySchema } from "@/server/modules/catalog/schemas";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const query = parseQueryParams(req, artistSearchQuerySchema);
    const result = await catalogService.searchArtists(query);
    return createSuccessResponse(result, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
