"use client";

import { useState } from "react";
import { usePrivy, useWallets, useLogin } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isPrivyConfigured } from "@/lib/auth/is-privy-configured";
import { safeFrom } from "@/lib/safe-redirect";

/**
 * Wallet pill in the product rail header.
 * When Privy is not configured, renders nothing — never calls usePrivy() without
 * a provider (PrivyProvider is a pass-through when the app id is unset).
 */
export function HeaderConnect() {
  if (!isPrivyConfigured()) return null;
  return <HeaderConnectLive />;
}

function HeaderConnectLive() {
  const { ready, authenticated } = usePrivy();
  if (!ready) return null;
  if (!authenticated) return <HeaderConnectGuest />;
  return <HeaderConnectAuthed />;
}

function HeaderConnectGuest() {
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login } = useLogin({
    // useRouter + window.location.search: header is in root layout without Suspense — useSearchParams would warn
    onComplete: () => {
      const from = new URLSearchParams(window.location.search).get("from");
      router.push(safeFrom(from, window.location.pathname));
    },
  });

  async function handleLoginClick() {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await login();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Privy can transiently reject before its hidden iframe is fully ready.
      // Keep the UI stable and let the user retry immediately.
      if (!/iframe not initialized/i.test(message)) {
        console.error("[HeaderConnect] login failed:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => void handleLoginClick()}
      disabled={isLoggingIn}
      className="connect-rail-identity__button"
    >
      {isLoggingIn ? "Opening…" : "Wallet"}
    </Button>
  );
}

function HeaderConnectAuthed() {
  const { logout, user } = usePrivy();
  const { wallets } = useWallets();

  const walletAddress = wallets[0]?.address ?? null;
  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : (user?.email?.address ?? user?.id?.slice(0, 12) ?? "—");

  return (
    <div className="connect-rail-identity__wallet">
      <Badge variant="flat" className="connect-rail-identity__badge">
        <span
          className="connect-rail-identity__dot"
          aria-hidden="true"
        />
        <span className="tabular">{displayAddress}</span>
      </Badge>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => void logout()}
        aria-label="Disconnect wallet"
        className="connect-rail-identity__button connect-rail-identity__button--ghost"
      >
        Disconnect
      </Button>
    </div>
  );
}
