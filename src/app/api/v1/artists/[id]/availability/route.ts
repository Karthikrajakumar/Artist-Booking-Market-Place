import { NextRequest } from "next/server";
import { getRequestId } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { catalogService } from "@/server/modules/catalog/catalogService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const { id } = await params;
    const availability = await catalogService.getArtistAvailability(id);
    return createSuccessResponse(availability, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
