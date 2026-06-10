"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { claimKycInquiry } from "@/app/onboarding/actions";

// ---------------------------------------------------------------------------
// Types — mirror the Persona JS SDK surface we actually use.
// We avoid importing @withpersona/persona-react to stay dependency-free.
// The SDK is loaded at runtime via the official CDN script tag.
// ---------------------------------------------------------------------------

interface PersonaSdkOptions {
  templateId: string;
  environment: "sandbox" | "production";
  referenceId?: string;
  // Fired once the inquiry exists (before the user finishes). This is the
  // earliest point the inquiryId is known — we use it to claim the inquiry
  // server-side as soon as possible, ahead of any terminal webhook (P0-4).
  onReady?: (inquiryId: string) => void;
  onComplete?: (data: { inquiryId: string; status: string }) => void;
  onCancel?: () => void;
  onError?: (error: { code: string; message: string }) => void;
}

// Persona attaches its constructor to `window.Persona` after the script loads.
declare global {
  interface Window {
    Persona?: {
      Client: new (options: PersonaSdkOptions) => {
        open: () => void;
        cancel: () => void;
      };
    };
  }
}

const PERSONA_SDK_URL =
  "https://cdn.withpersona.com/dist/persona-v5.1.4.js";

export interface PersonaEmbedProps {
  /** Persona template ID — use `process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID` */
  templateId: string;
  /** Sandbox for development, production for live */
  environment: "sandbox" | "production";
  /** External reference identifier (e.g. Investor.id) */
  referenceId?: string;
  /** Called when the inquiry completes successfully */
  onComplete?: (data: { inquiryId: string; status: string }) => void;
  /** Called when the user cancels the inquiry */
  onCancel?: () => void;
  /** Additional class names for the container */
  className?: string;
}

/**
 * PersonaEmbed
 *
 * Renders a button that launches the Persona embedded inquiry overlay.
 * The Persona JS SDK is injected once via a <script> tag; subsequent mounts
 * reuse the already-loaded SDK from `window.Persona`.
 *
 * No npm dependency on `@withpersona/persona-react` — script is loaded via CDN
 * to avoid adding a package that requires Persona account credentials at install
 * time and complicates the bundle. The CDN URL is pinned at v5.1.4.
 */
export function PersonaEmbed({
  templateId,
  environment,
  referenceId,
  onComplete,
  onCancel,
  className,
}: PersonaEmbedProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);
  // Track which inquiryIds we've already claimed so we never double-call the
  // server action — guards React Strict Mode double-invoke and the onReady +
  // onComplete double-fire (both legitimately carry the same inquiryId).
  const claimedInquiriesRef = useRef<Set<string>>(new Set());

  // Claim the inquiry → user binding on the server, exactly once per inquiryId.
  // Security (P0-4): the server resolves the approved account from THIS claim,
  // never from the Persona payload reference-id. Failures must not block the
  // KYC UI — the webhook's late-claim replay path still recovers the binding —
  // so we swallow errors and only log them.
  async function claimInquiryOnce(inquiryId: string): Promise<void> {
    if (!inquiryId || claimedInquiriesRef.current.has(inquiryId)) return;
    claimedInquiriesRef.current.add(inquiryId);
    try {
      await claimKycInquiry(inquiryId);
    } catch (err) {
      // Non-fatal: allow the inquiry to continue. Re-allow a retry on the next
      // signal by clearing the marker so a later onComplete can re-attempt.
      claimedInquiriesRef.current.delete(inquiryId);
      console.error("[persona-embed] claimKycInquiry failed:", err);
    }
  }

  // Inject the Persona SDK script once per page lifecycle.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already loaded — schedule state update via callback, not synchronously,
    // to satisfy react-hooks/set-state-in-effect lint rule.
    if (window.Persona) {
      const id = setTimeout(() => setSdkReady(true), 0);
      return () => clearTimeout(id);
    }

    // Script already injected (e.g. component remounted before load)
    if (scriptLoadedRef.current) return undefined;
    scriptLoadedRef.current = true;

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PERSONA_SDK_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => setSdkReady(true));
      return undefined;
    }

    const script = document.createElement("script");
    script.src = PERSONA_SDK_URL;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Failed to load KYC verification SDK.");
    document.head.appendChild(script);
    return undefined;
  }, []);

  function handleLaunch() {
    if (!window.Persona) {
      setError("Verification SDK is not ready. Please refresh and try again.");
      return;
    }

    setLoading(true);
    setError(null);

    const client = new window.Persona.Client({
      templateId,
      environment,
      referenceId,
      // Claim as early as the inquiryId exists — ahead of any terminal webhook.
      onReady: (inquiryId) => {
        void claimInquiryOnce(inquiryId);
      },
      onComplete: (data) => {
        setLoading(false);
        // Safety net: claim again on completion in case onReady never fired.
        // claimInquiryOnce is idempotent per inquiryId, so this is a no-op when
        // onReady already claimed it.
        void claimInquiryOnce(data.inquiryId);
        onComplete?.(data);
      },
      onCancel: () => {
        setLoading(false);
        onCancel?.();
      },
      onError: (err) => {
        setLoading(false);
        setError(`Verification error: ${err.message}`);
      },
    });

    client.open();
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <button
        type="button"
        disabled={!sdkReady || loading}
        onClick={handleLaunch}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5",
          "text-sm font-medium transition-opacity",
          "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "hover:opacity-90 active:opacity-75",
        )}
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Verifying…</span>
          </>
        ) : (
          <span>Begin Identity Verification</span>
        )}
      </button>

      {error !== null && (
        <p
          role="alert"
          className="text-xs text-[var(--ct-status-danger)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
