/**
 * client-nav.ts — Client-side fast-path navigation classifier.
 *
 * Purpose: make navigation TRULY instant. Today every chat message POSTs to
 * `/api/cockpit-chat` (auth + rate-limit + an LLM/network floor) even for a pure
 * navigation gesture ("ouvre mon portefeuille"). The regex resolvers that the
 * server already runs BEFORE any LLM call are pure + client-safe, so we can run
 * the SAME logic on the client and `router.push` with zero network round-trip.
 *
 * This module is the single seam between the cockpit-shell chat (ChatKimi) and
 * the app-side pure resolvers — ChatKimi imports only `resolveClientNav` so the
 * shell takes exactly one `@/` dependency instead of three.
 *
 * Profile scope (deliberate, see step 1 of the design):
 *  - The client does NOT statically know the user's role. The shell, AppChrome,
 *    ChatKimi and ChatNavBridge receive no `isAdmin`/role prop or context; admin
 *    status is only discovered server-side (session) or via a deferred
 *    `GET /api/admin/review-mode` probe in AdminChatControls.
 *  - So the fast-path runs at LP scope only (`navProfile: "lp"`, `isAdmin:
 *    false`). LP navigation — the common case — becomes instant. Admin
 *    navigation does NOT resolve a destination here, falls through to a normal
 *    POST, and the SERVER (which knows the real role) handles it exactly as
 *    today. Correct + safe by construction: the client can never escalate to an
 *    admin route it is not entitled to.
 *
 * Defense-in-depth: this is an OPTIMIZATION layer. The server early-exit in
 * `/api/cockpit-chat/route.ts` stays fully intact as the fallback for any client
 * that doesn't run this JS and for admin navigation.
 *
 * Pure module: no I/O, no React, no `server-only`. Unit-tested in
 * `__tests__/client-nav.test.ts`.
 */

import {
  looksLikeNavIntent,
  resolveNavFallbackDestinationKey,
  NAV_SHORTCUT_ACK,
  NAV_REJECT_ACK,
  buildNavShortcutAck,
  buildNavRejectAck,
} from "@/lib/llm/nav-fallback-intent";
import { resolveNavDestinationForProfile } from "@/lib/llm/navigate-tool";

export { NAV_SHORTCUT_ACK, NAV_REJECT_ACK };

export type ClientNavKind = "nav" | "reject" | "chat";

export interface ClientNavResult {
  kind: ClientNavKind;
  /** SPA route to push — present only when `kind === "nav"`. */
  route?: string;
  /** Human label for the destination — present only when `kind === "nav"`. */
  label?: string;
  /** Fixed assistant bubble to echo locally — present for "nav" / "reject". */
  ack?: string;
}

/**
 * Classify a chat message for the client fast-path.
 *
 *  - `nav`    → the message resolved a whitelisted LP destination. Navigate
 *               locally (zero network) and echo NAV_SHORTCUT_ACK.
 *  - `reject` → the message is a navigation gesture (a nav verb) but matched no
 *               destination. Echo NAV_REJECT_ACK locally (zero network) — the
 *               server would only have said the same thing after an LLM call.
 *  - `chat`   → a real question (or admin navigation, which is out of LP scope).
 *               Caller MUST POST to the server exactly as today.
 *
 * A real question can NEVER be swallowed: only a resolved destination or a
 * `looksLikeNavIntent` match short-circuits; everything else returns "chat".
 */
export function resolveClientNav(message: string): ClientNavResult {
  const text = message.trim();
  if (!text) return { kind: "chat" };

  const navKey = resolveNavFallbackDestinationKey({
    navProfile: "lp",
    isAdmin: false,
    message: text,
  });

  if (navKey) {
    const dest = resolveNavDestinationForProfile(navKey, "lp");
    if (dest) {
      return {
        kind: "nav",
        route: dest.route,
        label: dest.label,
        ack: buildNavShortcutAck(text),
      };
    }
  }

  // A nav-verb gesture that matched no LP destination → instant local reject.
  if (looksLikeNavIntent(text)) {
    return { kind: "reject", ack: buildNavRejectAck(text) };
  }

  // Real question (or admin nav out of LP scope) → server.
  return { kind: "chat" };
}
