import "server-only";
import { SmsAdapter } from "./interface";
import { smsAdapter as fakeSmsAdapter } from "./fake";

export function getSmsAdapter(): SmsAdapter {
  if (process.env.NODE_ENV === "production") {
    // In production, FakeSmsAdapter is strictly forbidden
    throw new Error(
      "[SMS Provider] FakeSmsAdapter cannot be used in production. A production SMS adapter must be configured."
    );
  }
  return fakeSmsAdapter;
}

export * from "./interface";
export { smsAdapter } from "./fake";
