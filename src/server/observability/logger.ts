import "server-only";
import pino from "pino";

// Redact sensitive properties to prevent credential and PII leakage
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: [
      "code",
      "otp",
      "phone",
      "phoneNumber",
      "token",
      "tokenHash",
      "authorization",
      "cookie",
      "*.code",
      "*.otp",
      "*.phone",
      "*.phoneNumber",
      "*.token",
      "*.tokenHash",
      "*.authorization",
      "*.cookie",
      "req.headers.cookie",
      "req.headers.authorization",
      "req.headers['x-csrf-token']",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
