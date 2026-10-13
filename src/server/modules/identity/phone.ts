import "server-only";
import { AppError } from "../../api/envelope";

/**
 * Normalises phone numbers into E.164 format.
 * Initially supports Indian mobile numbers (+91 followed by 10 digits starting with 6-9).
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== "string") {
    throw new AppError(422, "UNPROCESSABLE_ENTITY", "Phone number is required.", [
      { field: "phone", message: "Phone number is required." },
    ]);
  }

  // Remove whitespace, hyphens, parentheses, and dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  // Convert leading '0' (domestic trunk prefix) to +91
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "+91" + cleaned.slice(1);
  }

  // If 10 digits without country code, prefix +91
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = "+91" + cleaned;
  }

  // Ensure leading plus
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  // E.164 validation for Indian mobile numbers: +91 followed by 10 digits starting with 6, 7, 8, or 9
  const indianMobileRegex = /^\+91[6-9]\d{9}$/;
  if (!indianMobileRegex.test(cleaned)) {
    throw new AppError(
      422,
      "UNPROCESSABLE_ENTITY",
      "Invalid phone number. Only valid 10-digit Indian mobile numbers (+91) are currently supported.",
      [{ field: "phone", message: "Must be a valid 10-digit Indian mobile number." }]
    );
  }

  return cleaned;
}
