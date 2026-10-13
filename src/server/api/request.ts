import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "./envelope";
import { randomUUID } from "node:crypto";

export function getRequestId(req: NextRequest): string {
  const existing = req.headers.get("x-request-id");
  if (existing && existing.trim().length > 0) {
    return existing.trim();
  }
  return `req_${randomUUID().replace(/-/g, "")}`;
}

export async function parseJsonBody<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, "BAD_REQUEST", "Malformed JSON request body.");
  }
  return schema.parse(body);
}
