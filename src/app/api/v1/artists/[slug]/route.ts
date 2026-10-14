import { NextRequest } from "next/server";
import { getRequestId } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { catalogService } from "@/server/modules/catalog/catalogService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const { slug } = await params;
    const artist = await catalogService.getPublishedArtistBySlug(slug);
    return createSuccessResponse(artist, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
