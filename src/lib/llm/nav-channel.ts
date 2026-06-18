import "server-only";

import { getRedis } from "@/lib/rate-limit";
import {
  resolveNavDestination,
} from "@/lib/llm/navigate-tool";
import type { ProductWorkspaceIntentKind } from "@/lib/llm/product-workspace-intent";

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
const NAV_TTL_SECONDS = 90;

const navKey = (userId: string): string => `chatnav:${userId}`;

/** In-memory fallback when Upstash isn't configured (dev / single instance). */
interface StoredNavDirective {
  destinationKey: string;
  objective?: string;
  autostart?: boolean;
  intentKind?: ProductWorkspaceIntentKind;
  secondaryDestinationKey?: string;
  secondaryHint?: string;
}

export interface ConsumedNavDirective {
  route: string;
  label: string;
  objective?: string;
  autostart?: boolean;
  intentKind?: ProductWorkspaceIntentKind;
  secondaryRoute?: string;
  secondaryLabel?: string;
  secondaryHint?: string;
}

const MAX_OBJECTIVE_LEN = 220;
const MAX_HINT_LEN = 120;
const memNav = new Map<string, { payload: string; at: number }>();

function sanitizeObjective(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, MAX_OBJECTIVE_LEN);
}

function sanitizeHint(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, MAX_HINT_LEN);
}

function normalizeDirective(
  input: string | StoredNavDirective,
): StoredNavDirective | null {
  if (typeof input === "string") {
    if (!resolveNavDestination(input)) return null;
    return { destinationKey: input };
  }

  const destination = resolveNavDestination(input.destinationKey);
  if (!destination) return null;
  const supportsSeededObjective =
    input.destinationKey === "admin-product-workspace" ||
    input.destinationKey === "admin-scenario-lab";
  const objective = supportsSeededObjective
    ? sanitizeObjective(input.objective)
    : undefined;
  const autostart = supportsSeededObjective && input.autostart === true ? true : undefined;
  const secondaryDestination =
    input.secondaryDestinationKey && supportsSeededObjective
      ? resolveNavDestination(input.secondaryDestinationKey)
      : null;
  const secondaryHint = secondaryDestination
    ? sanitizeHint(input.secondaryHint)
    : undefined;
  return {
    destinationKey: input.destinationKey,
    ...(objective ? { objective } : {}),
    ...(autostart ? { autostart } : {}),
    ...(input.intentKind ? { intentKind: input.intentKind } : {}),
    ...(secondaryDestination
      ? { secondaryDestinationKey: secondaryDestination.key }
      : {}),
    ...(secondaryHint ? { secondaryHint } : {}),
  };
}

/**
 * Publish the navigation destination the model chose for `userId`. `key` is a
 * whitelist destination key (e.g. "portfolio"); an unknown key is dropped.
 */
export async function publishNav(
  userId: string,
  directive: string | StoredNavDirective,
): Promise<void> {
  const normalized = normalizeDirective(directive);
  if (!normalized) return;
  const payload = JSON.stringify(normalized);

  const redis = getRedis();
  if (redis) {
    await redis.set(navKey(userId), payload, { ex: NAV_TTL_SECONDS });
    return;
  }
  memNav.set(userId, { payload, at: Date.now() });
}

/**
 * Atomically read-and-clear the pending navigation destination for `userId`,
 * or null when none is pending / it expired / it is no longer whitelisted.
 */
export async function consumeNav(
  userId: string,
): Promise<ConsumedNavDirective | null> {
  const redis = getRedis();
  let payload: string | null = null;

  if (redis) {
    payload = await redis.getdel<string>(navKey(userId));
  } else {
    const entry = memNav.get(userId);
    if (entry) {
      memNav.delete(userId);
      if (Date.now() - entry.at <= NAV_TTL_SECONDS * 1000) {
        payload = entry.payload;
      }
    }
  }

  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as StoredNavDirective;
    const destination = resolveNavDestination(parsed.destinationKey);
    if (!destination) return null;
    const secondaryDestination = parsed.secondaryDestinationKey
      ? resolveNavDestination(parsed.secondaryDestinationKey)
      : null;
    return {
      route: destination.route,
      label: destination.label,
      ...(parsed.objective ? { objective: parsed.objective } : {}),
      ...(parsed.autostart ? { autostart: true } : {}),
      ...(parsed.intentKind ? { intentKind: parsed.intentKind } : {}),
      ...(secondaryDestination
        ? {
            secondaryRoute: secondaryDestination.route,
            secondaryLabel: secondaryDestination.label,
          }
        : {}),
      ...(parsed.secondaryHint ? { secondaryHint: parsed.secondaryHint } : {}),
    };
  } catch {
    // Backward compatibility: older payloads stored only destination key.
    const destination = resolveNavDestination(payload);
    if (!destination) return null;
    return {
      route: destination.route,
      label: destination.label,
    };
  }
}
