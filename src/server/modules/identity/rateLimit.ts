import "server-only";
import { AppError } from "../../api/envelope";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  checkLimit(key: string, limit: number, windowSeconds: number): void {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return;
    }

    if (bucket.count >= limit) {
      throw new AppError(
        429,
        "TOO_MANY_REQUESTS",
        "Rate limit exceeded. Please try again later."
      );
    }

    bucket.count += 1;
  }

  reset(): void {
    this.buckets.clear();
  }
}

export const rateLimiter = new InMemoryRateLimiter();
