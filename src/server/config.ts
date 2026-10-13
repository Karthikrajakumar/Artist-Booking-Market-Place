import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  OTP_HMAC_SECRET: z.string().min(32, "OTP_HMAC_SECRET must be at least 32 characters long"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters long"),
  SESSION_IDLE_EXPIRY_SECONDS: z.coerce.number().positive().default(7 * 24 * 60 * 60), // 7 days
  SESSION_ABSOLUTE_EXPIRY_SECONDS: z.coerce.number().positive().default(30 * 24 * 60 * 60), // 30 days
  OTP_EXPIRY_SECONDS: z.coerce.number().positive().default(300), // 5 minutes
  OTP_MAX_ATTEMPTS: z.coerce.number().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().positive().default(60), // 60 seconds
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `[Config] Invalid environment configuration:\n${errorDetails}\nPlease check your .env or system environment variables.`
    );
  }
  return result.data;
}

export const config = loadConfig();
