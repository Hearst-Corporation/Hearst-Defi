import "server-only";

import { getRedis } from "@/lib/rate-limit";
import {
  resolveNavDestination,
} from "@/lib/llm/navigate-tool";
import { isCanvasId } from "@/lib/canvas/contract";
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
  /** Agent-canvas only: which canvas workshop to open (e.g. "create-vault"). */
  canvasId?: string;
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
  canvasId?: string;
}

const MAX_OBJECTIVE_LEN = 220;
const MAX_HINT_LEN = 120;
// In-memory fallback store (used when Upstash isn't configured). Hoisted onto
// globalThis so it is SHARED across every API route module instance in a single
// server process: Next.js dev (Turbopack) + HMR can give /api/cockpit-chat and
// /api/chat-nav their OWN copy of this module, so a plain module-level `Map`
// would let publishNav() write to one instance while consumeNav() reads an empty
// other one — the nav directive then never reaches the <ChatNavBridge> and the
// agent "answers" but never opens the page. (Multi-instance/serverless prod still
// needs Upstash; this single-process fallback cannot bridge separate lambdas.)
const globalForNav = globalThis as unknown as {
  __hearstNavChannel?: Map<string, { payload: string; at: number }>;
};
const memNav: Map<string, { payload: string; at: number }> =
  globalForNav.__hearstNavChannel ??
  (globalForNav.__hearstNavChannel = new Map<
    string,
    { payload: string; at: number }
  >());

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
  // Destinations that accept a seeded objective + autostart from the agent: the
  // product workspace, the scenario lab, and the agent-canvas family. Keeping
  // this as a small set (not an open flag) preserves the "agent can only seed
  // the pages we built for it" invariant.
  const isCanvas =
    input.destinationKey === "admin-agent-canvas" ||
    input.destinationKey === "lp-agent-canvas";
  const supportsSeededObjective =
    input.destinationKey === "admin-product-workspace" ||
    input.destinationKey === "admin-scenario-lab" ||
    isCanvas;
  const objective = supportsSeededObjective
    ? sanitizeObjective(input.objective)
    : undefined;
  const autostart = supportsSeededObjective && input.autostart === true ? true : undefined;
  // canvasId is only meaningful for the agent-canvas family, and must be one of
  // the closed CanvasId set — an unknown id is dropped (the page then 404s).
  const canvasId = isCanvas && isCanvasId(input.canvasId) ? input.canvasId : undefined;
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
    ...(canvasId ? { canvasId } : {}),
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
  // NOTE: the type is `unknown`, NOT `string`. The @upstash/redis client
  // AUTO-DESERIALIZES JSON on read: a payload we stored as the JSON string
  // '{"destinationKey":"vaults"}' comes back as an already-parsed OBJECT, while
  // the in-memory fallback returns the raw JSON string. The old code typed this
  // as `string` and always `JSON.parse`d it — which THREW on the Upstash object
  // ("[object Object]" is not JSON) and silently dropped EVERY navigation in any
  // environment with Upstash configured. We now accept both shapes.
  let raw: unknown = null;

  if (redis) {
    raw = await redis.getdel(navKey(userId));
  } else {
    const entry = memNav.get(userId);
    if (entry) {
      memNav.delete(userId);
      if (Date.now() - entry.at <= NAV_TTL_SECONDS * 1000) {
        raw = entry.payload;
      }
    }
  }

  if (raw == null) return null;

  // Normalize raw → directive object, tolerating: an object (Upstash auto-parse),
  // a JSON string (in-memory fallback), or a legacy bare destination-key string.
  let parsed: StoredNavDirective | null = null;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as StoredNavDirective;
    } catch {
      // Backward compatibility: older payloads stored only the destination key.
      const destination = resolveNavDestination(raw);
      return destination
        ? { route: destination.route, label: destination.label }
        : null;
    }
  } else if (typeof raw === "object") {
    parsed = raw as StoredNavDirective;
  }

  if (!parsed || typeof parsed.destinationKey !== "string") return null;

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
    ...(parsed.canvasId && isCanvasId(parsed.canvasId)
      ? { canvasId: parsed.canvasId }
      : {}),
    ...(secondaryDestination
      ? {
          secondaryRoute: secondaryDestination.route,
          secondaryLabel: secondaryDestination.label,
        }
      : {}),
    ...(parsed.secondaryHint ? { secondaryHint: parsed.secondaryHint } : {}),
  };
}
