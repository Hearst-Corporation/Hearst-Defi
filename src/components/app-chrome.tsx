"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { ConnectShell } from "@/components/ConnectShell";
import { AppFooter } from "@/components/app-footer";
import { AdminChatControls } from "@/components/admin/admin-chat-controls";
import { ChatNavBridge } from "@/components/chat/chat-nav-bridge";

// Routes/prefixes that render WITHOUT the product chrome (left rail, bottom
// nav, cockpit chat). The sign-in screen must stand alone — no navigation into
// product surfaces is offered until the user is authenticated. Legal pages
// (/legal/*) use their own LegalLayout and must not get a double chrome.
const BARE_EXACT = new Set<string>([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/totp-challenge",
]);
// /apply renders standalone: the qualification chamber carries its own inline
// assistant panel (ApplyAssistantPanel), so it must NOT get the Cockpit chat
// rail. /legal/* uses its own LegalLayout.
const BARE_PREFIXES = ["/legal", "/apply"] as const;

function isBareRoute(pathname: string): boolean {
  if (BARE_EXACT.has(pathname)) return true;
  return BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Authenticated surfaces that keep the shell but must NOT show the chat rail:
// the onboarding/KYC funnel has its own focused chrome (the chat would be a
// double-chrome distraction mid-flow), and /debug is a dev-only scaffold.
const NO_CHAT_PREFIXES = ["/onboarding", "/debug"] as const;

function isNoChatRoute(pathname: string): boolean {
  return NO_CHAT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Decides whether to wrap children in the full Cockpit shell or render them
 * bare. The shell (rail + chat + bottom nav) is for authenticated product
 * surfaces; the auth screens opt out so nothing leaks before sign-in.
 */
export function AppChrome({
  children,
  // Resolved server-side from the CHAT_MASTER_AGENT flag (server-only env). When
  // OFF, the navigation bridge must NOT mount: publishNav is never called, so
  // polling /api/chat-nav every few seconds for 100% of authenticated users
  // would be pure wasted load.
  masterAgentEnabled = false,
}: {
  children: ReactNode;
  masterAgentEnabled?: boolean;
}) {
  const pathname = usePathname();
  const bare = isBareRoute(pathname);

  if (bare) {
    return <div className="min-h-dvh bg-(--ct-bg-deep)">{children}</div>;
  }

  // The conversational Master Agent is available on every authenticated product
  // surface — LP investors and admins alike — EXCEPT the onboarding funnel and
  // /debug (see NO_CHAT_PREFIXES). Bare auth/legal routes already returned
  // above. Server-side guardrails (no client system override, output-side
  // compliance guard, role-aware register) make this LP-facing surface safe.
  const chatEnabled = !isNoChatRoute(pathname);

  return (
    <ConnectShell enableChat={chatEnabled}>
      {children}
      {/* Global legal footer — keeps Disclaimer / Privacy / Terms reachable on
          every authenticated surface (bare auth/legal routes returned above). */}
      <AppFooter />
      {/* Chat mode selector (Conversation / Review). Self-gates to admins via
          the requireAdmin-protected /api/admin/review-mode route; renders
          nothing for everyone else. Mounted here so it's available on every
          product page, not just /admin. */}
      <AdminChatControls />
      {/* Master Agent auto-navigation bridge — only when the chat is enabled
          AND the Master Agent flag is ON. With the flag OFF the server never
          publishes a nav directive, so mounting the poller would be dead load. */}
      {chatEnabled && masterAgentEnabled ? <ChatNavBridge /> : null}
    </ConnectShell>
  );
}
