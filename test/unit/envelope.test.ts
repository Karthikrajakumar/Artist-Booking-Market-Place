import { describe, it, expect } from "vitest";
import { createSuccessResponse, createErrorResponse, AppError } from "@/server/api/envelope";
import { ZodError, z } from "zod";

describe("API Envelope Shapes", () => {
  it("formats success envelope with data and requestId", async () => {
    const data = { id: "user_123", name: "Ananya" };
    const res = createSuccessResponse(data, "req_abc123", 200, { nextCursor: null });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      data: { id: "user_123", name: "Ananya" },
      meta: { nextCursor: null },
      requestId: "req_abc123",
    });
  });

  it("formats error envelope with error code, message, fields, and requestId", async () => {
    const error = new AppError(409, "CONFLICT", "Resource conflict occurred.", [
      { field: "code", message: "Code was already consumed." },
    ]);
    const res = createErrorResponse(error, "req_err123");
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toEqual({
      error: {
        code: "CONFLICT",
        message: "Resource conflict occurred.",
        fields: [{ field: "code", message: "Code was already consumed." }],
      },
      requestId: "req_err123",
    });
  });

  it("converts Zod validation errors to 422 with field-level details", async () => {
    const testSchema = z.object({ age: z.number() });
    let zodError: ZodError | null = null;
    try {
      testSchema.parse({ age: "invalid" });
    } catch (e) {
      zodError = e as ZodError;
    }

    const res = createErrorResponse(zodError, "req_zod123");
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error.code).toBe("UNPROCESSABLE_ENTITY");
    expect(json.error.fields.length).toBeGreaterThan(0);
    expect(json.error.fields[0].field).toBe("age");
  });

  it("never leaks stack traces in unexpected server errors (500)", async () => {
    const rawError = new Error("Database connection timed out at line 55 /secret/path");
    const res = createErrorResponse(rawError, "req_500");
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(json.error.message).toBe("An unexpected internal server error occurred.");
    expect(json.error.fields).toEqual([]);
    expect(JSON.stringify(json)).not.toContain("/secret/path");
  });
});
