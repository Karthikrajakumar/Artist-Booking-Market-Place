import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    setupFiles: ["./test/setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://ind64:ind64_secret_test_password@localhost:5433/ind64_test",
      OTP_HMAC_SECRET: "ind64_super_secret_otp_hmac_key_at_least_32_chars",
      SESSION_SECRET: "ind64_super_secret_session_encryption_key_32_chars",
      APP_ORIGIN: "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
