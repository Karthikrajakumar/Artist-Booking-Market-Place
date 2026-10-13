import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "../observability/logger";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "TOO_MANY_REQUESTS"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "INVALID_OTP"
  | "OTP_EXPIRED"
  | "OTP_MAX_ATTEMPTS_EXCEEDED"
  | "OTP_COOLDOWN"
  | "CSRF_FORBIDDEN"
  | "PROVIDER_ERROR";

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiSuccessEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  requestId: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode | string;
    message: string;
    fields: FieldError[];
  };
  requestId: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly fields: FieldError[];

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    fields: FieldError[] = []
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  statusCode = 200,
  meta?: Record<string, unknown>
): NextResponse<ApiSuccessEnvelope<T>> {
  const payload: ApiSuccessEnvelope<T> = {
    data,
    requestId,
    ...(meta ? { meta } : {}),
  };
  return NextResponse.json(payload, { status: statusCode });
}

export function createErrorResponse(
  error: unknown,
  requestId: string
): NextResponse<ApiErrorEnvelope> {
  if (error instanceof AppError) {
    logger.warn({ requestId, err: error, code: error.code }, "Handled application error");
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
        },
        requestId,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    const fields: FieldError[] = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    logger.warn({ requestId, err: error, fields }, "Validation error");
    return NextResponse.json(
      {
        error: {
          code: "UNPROCESSABLE_ENTITY",
          message: "Validation failed for request payload.",
          fields,
        },
        requestId,
      },
      { status: 422 }
    );
  }

  // Fallback for unhandled unexpected server errors - NEVER leak stack traces
  logger.error({ requestId, err: error }, "Unhandled server error");
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected internal server error occurred.",
        fields: [],
      },
      requestId,
    },
    { status: 500 }
  );
}
