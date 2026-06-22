"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { CONNECT_ACCENT_HEX } from "@/lib/brand-constants";

// Privy (via styled-components) evaluates React hooks at module level,
// which crashes Next.js 16 SSR prerender of special pages (/_not-found, /_global-error).
// Dynamic import with ssr:false ensures the Privy module only loads in the browser.
const PrivyNoSSR = dynamic(
  () =>
    import("@privy-io/react-auth").then((mod) => ({
      default: mod.PrivyProvider,
    })),
  { ssr: false }
);

const PRIVY_CONFIG = {
  appearance: {
    theme: "dark" as const,
    accentColor: CONNECT_ACCENT_HEX,
    logo: "/logos/hearst-connect.svg",
  },
  loginMethods: ["email", "wallet"] as ["email", "wallet"],
  // Pilot: do NOT auto-create a Privy embedded wallet. Investors connect their
  // own external wallet (MetaMask, Ledger, …) — auto-creating an embedded wallet
  // silently bound a wallet the LP did not choose and re-bound it on every load.
  embeddedWallets: {
    ethereum: { createOnLogin: "off" as const },
  },
};

/**
 * Wraps the app in Privy's React context.
 *
 * When `appId` is empty (local dev without the env var set), this component
 * is a pass-through — the app renders normally, the login button is a no-op,
 * and the middleware also lets gated routes through. This keeps the local
 * dev loop friction-free until the Privy keys are wired up.
 */
export function PrivyProvider({
  children,
  appId,
}: {
  children: ReactNode;
  appId: string;
}) {
  if (!appId) return <>{children}</>;

  return (
    <PrivyNoSSR appId={appId} config={PRIVY_CONFIG}>
      {children}
    </PrivyNoSSR>
  );
}
