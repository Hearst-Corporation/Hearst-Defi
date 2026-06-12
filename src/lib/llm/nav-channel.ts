import "server-only";

import { getRedis } from "@/lib/rate-limit";
import {
  resolveNavDestination,
  type NavDestination,
} from "@/lib/llm/navigate-tool";

/**
 * Out-of-band navigation channel for the LP Master Agent.
 *
 * The conversational chat streams its text answer through the (unchanged)
 * cockpit-shell client, which the app cannot tap. So when the model calls the
 * `navigate` tool, the server publishes the chosen destination to a short-lived
 * per-user channel here; the client `<ChatNavBridge>` polls `consumeNav` (via
 * /api/chat-nav) and performs the router.push. This keeps the shared package
 * untouched while still delivering auto-navigation.
 *
 * The TTL is deliberately SHORT: a navigation intent is only relevant for the
 * few seconds around the answer. A stale directive must never fire on a page
 * the user reached later. `consume` is read-and-delete (single fire).
 */

/** Seconds a published nav directive stays valid before it self-expires. */
const NAV_TTL_SECONDS = 25;

const navKey = (userId: string): string => `chatnav:${userId}`;

/** In-memory fallback when Upstash isn't configured (dev / single instance). */
const memNav = new Map<string, { key: string; at: number }>();

/**
 * Publish the navigation destination the model chose for `userId`. `key` is a
 * whitelist destination key (e.g. "portfolio"); an unknown key is dropped.
 */
export async function publishNav(
  userId: string,
  destinationKey: string,
): Promise<void> {
  // Validate against the whitelist BEFORE storing — never persist a key the
  // bridge would reject anyway.
  if (!resolveNavDestination(destinationKey)) return;

  const redis = getRedis();
  if (redis) {
    await redis.set(navKey(userId), destinationKey, { ex: NAV_TTL_SECONDS });
    return;
  }
  memNav.set(userId, { key: destinationKey, at: Date.now() });
}

/**
 * Atomically read-and-clear the pending navigation destination for `userId`,
 * or null when none is pending / it expired / it is no longer whitelisted.
 */
export async function consumeNav(
  userId: string,
): Promise<NavDestination | null> {
  const redis = getRedis();
  let key: string | null = null;

  if (redis) {
    key = await redis.getdel<string>(navKey(userId));
  } else {
    const entry = memNav.get(userId);
    if (entry) {
      memNav.delete(userId);
      if (Date.now() - entry.at <= NAV_TTL_SECONDS * 1000) {
        key = entry.key;
      }
    }
  }

  return resolveNavDestination(key);
}
