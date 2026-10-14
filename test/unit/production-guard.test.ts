import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/__dev/last-otp/route";
import { getSmsAdapter } from "@/server/providers/sms";
import { NextRequest } from "next/server";

describe("Production Guards", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as any).NODE_ENV = originalEnv;
  });

  it("GET /api/__dev/last-otp returns 404 in production", async () => {
    (process.env as any).NODE_ENV = "production";

    const req = new NextRequest("http://localhost:3000/api/__dev/last-otp?phone=%2B919876543210");
    const res = await GET(req);

    expect(res.status).toBe(404);
  });

  it("startup fails / throws if FakeSmsAdapter is selected in production", () => {
    (process.env as any).NODE_ENV = "production";

    expect(() => getSmsAdapter()).toThrowError(/FakeSmsAdapter cannot be used in production/);
  });

});
