import "server-only";
import { SmsAdapter } from "./interface";
import { logger } from "../../observability/logger";

class FakeSmsAdapter implements SmsAdapter {
  private inMemoryCodes = new Map<string, string>();
  private failurePhones = new Set<string>();

  async sendOtp(phone: string, code: string): Promise<boolean> {
    // If simulated failure phone
    if (this.failurePhones.has(phone)) {
      logger.warn("Simulated provider SMS delivery failure");
      return false;
    }

    // Never log the full phone or code
    this.inMemoryCodes.set(phone, code);
    logger.debug("Fake SMS adapter saved OTP for test verification");
    return true;
  }

  getLastOtp(phone: string): string | undefined {
    return this.inMemoryCodes.get(phone);
  }

  setSimulatedFailure(phone: string, fail: boolean): void {
    if (fail) {
      this.failurePhones.add(phone);
    } else {
      this.failurePhones.delete(phone);
    }
  }

  clear(): void {
    this.inMemoryCodes.clear();
    this.failurePhones.clear();
  }
}

export const smsAdapter = new FakeSmsAdapter();
