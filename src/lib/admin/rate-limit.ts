import { assertRateLimit } from "@/lib/rate-limit";

/**
 * Shared rate limit helper for admin actions.
 * Throws "Too many requests" if the limit is exceeded.
 */
export async function assertAdminRateLimit(
  userId: string,
  scope: string,
  max: number,
  windowMs: number,
) {
  try {
    await assertRateLimit(`admin:${scope}:${userId}`, max, windowMs);
  } catch {
    throw new Error("Too many requests");
  }
}
