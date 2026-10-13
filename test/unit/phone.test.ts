import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/server/modules/identity/phone";
import { AppError } from "@/server/api/envelope";

describe("Phone normalization (E.164)", () => {
  it("normalizes a 10-digit Indian mobile number by prefixing +91", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
    expect(normalizePhone("7123456789")).toBe("+917123456789");
    expect(normalizePhone("8123456789")).toBe("+918123456789");
    expect(normalizePhone("6123456789")).toBe("+916123456789");
  });

  it("handles numbers with spaces, hyphens, and parentheses", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("98765-43210")).toBe("+919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("(+91) 98765-43210")).toBe("+919876543210");
  });

  it("converts leading zero trunk prefix to +91", () => {
    expect(normalizePhone("09876543210")).toBe("+919876543210");
  });

  it("rejects non-Indian or invalid mobile numbers", () => {
    // Starts with invalid digit (< 6)
    expect(() => normalizePhone("5123456789")).toThrow(AppError);
    // Too short
    expect(() => normalizePhone("98765")).toThrow(AppError);
    // Too long
    expect(() => normalizePhone("9876543210123")).toThrow(AppError);
    // Letters
    expect(() => normalizePhone("98765abcde")).toThrow(AppError);
  });
});
