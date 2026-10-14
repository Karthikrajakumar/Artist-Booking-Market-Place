import { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { getRequestId } from "@/server/api/request";
import { createSuccessResponse, createErrorResponse } from "@/server/api/envelope";
import { shortlistService } from "@/server/modules/shortlist/shortlistService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const { artistId } = await params;

    const isShortlisted = await shortlistService.isShortlisted(context.user.id, artistId);
    return createSuccessResponse({ isShortlisted }, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const { artistId } = await params;

    const result = await shortlistService.saveArtist(context.user.id, artistId);
    return createSuccessResponse(result, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const context = await requireAuth(req);
    const { artistId } = await params;

    const result = await shortlistService.removeArtist(context.user.id, artistId);
    return createSuccessResponse(result, requestId, 200);
  } catch (error) {
    return createErrorResponse(error, requestId);
  }
}
