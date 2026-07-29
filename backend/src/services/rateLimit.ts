import IORedis from "ioredis";
import { config } from "../config";

// Separate Redis connection for rate limiting (not BullMQ)
const rateLimitRedis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
});

/**
 * Atomically increments the hourly email counter for a sender.
 * Key format: rate:{senderId}:{YYYY-MM-DD-HH}
 * Uses INCR + EXPIRE for atomic, cross-process-safe rate limiting.
 *
 * @returns { allowed: boolean, count: number, nextWindowMs: number }
 */
export async function checkAndIncrementRate(
  senderId: string,
  maxPerHour: number
): Promise<{ allowed: boolean; count: number; nextWindowMs: number }> {
  const now = new Date();
  const hourWindow = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;
  const key = `rate:${senderId}:${hourWindow}`;

  // Atomically increment and set expiry in a pipeline
  const pipeline = rateLimitRedis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, 3600);
  const results = await pipeline.exec();

  const count = results?.[0]?.[1] as number ?? 0;

  // Calculate ms until next hour window
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  const nextWindowMs = nextHour.getTime() - now.getTime();

  if (count > maxPerHour) {
    // Decrement back since we didn't actually send
    await rateLimitRedis.decr(key);
    return { allowed: false, count: count - 1, nextWindowMs };
  }

  return { allowed: true, count, nextWindowMs };
}

/**
 * Get the current rate count for a sender in the current hour (without incrementing).
 */
export async function getCurrentRate(senderId: string): Promise<number> {
  const now = new Date();
  const hourWindow = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;
  const key = `rate:${senderId}:${hourWindow}`;
  const count = await rateLimitRedis.get(key);
  return count ? parseInt(count, 10) : 0;
}

export { rateLimitRedis };
