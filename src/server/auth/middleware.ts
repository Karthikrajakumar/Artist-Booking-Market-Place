import "server-only";
import { NextRequest } from "next/server";
import { sessionService, SessionContext } from "./session";
import { AppError } from "../api/envelope";
import { config } from "../config";

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-ind64-session" : "ind64-session";

/**
 * Validates Origin header for state-changing requests (POST, PUT, PATCH, DELETE).
 */
export function validateOrigin(req: NextRequest): void {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return;
  }

  const origin = req.headers.get("origin");
  if (!origin) {
    // Some non-browser API clients don't send origin, but for browser-bound CSRF we enforce
    return;
  }

  try {
    const originUrl = new URL(origin);
    const appUrl = new URL(config.APP_ORIGIN);
    if (originUrl.origin !== appUrl.origin) {
      throw new AppError(403, "CSRF_FORBIDDEN", "Cross-origin request rejected.");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(403, "CSRF_FORBIDDEN", "Invalid origin header.");
  }
}

/**
 * Validates session cookie and CSRF token for mutating requests.
 */
export async function requireAuth(req: NextRequest): Promise<SessionContext> {
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required. No active session.");
  }

  const context = await sessionService.validateSession(sessionToken);
  if (!context) {
    throw new AppError(401, "UNAUTHORIZED", "Session expired or invalid.");
  }

  // Validate CSRF token on state-changing requests
  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    validateOrigin(req);
    const csrfHeader = req.headers.get("x-csrf-token");
    if (!csrfHeader || !sessionService.validateCsrfToken(context.sessionId, csrfHeader)) {
      throw new AppError(403, "CSRF_FORBIDDEN", "Invalid or missing CSRF token.");
    }
  }

  return context;
}

/**
 * Optional authentication helper
 */
export async function getOptionalAuth(req: NextRequest): Promise<SessionContext | null> {
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;
  return await sessionService.validateSession(sessionToken);
}
