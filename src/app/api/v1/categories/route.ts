import { NextRequest } from "next/server";
import { getRequestId } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { catalogService } from "@/server/modules/catalog/catalogService";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const categories = await catalogService.listCategories();
    return createSuccessResponse(categories, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
