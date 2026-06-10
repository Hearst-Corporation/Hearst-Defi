"use client";

/**
 * DocusignEmbedded — inline DocuSign signing ceremony iframe.
 *
 * Renders a full-bleed iframe pointed at the DocuSign embedded signing URL.
 * The component is intentionally thin: all envelope creation happens server-side
 * in `src/lib/onboarding/actions.ts`. This component receives an already-created
 * `envelopeId` and the one-time `signingUrl` (a DocuSign-issued JWT URL).
 *
 * Lifecycle:
 *   1. Parent calls `createSubscriptionEnvelope()` server action → gets back
 *      `{ envelopeId, signingUrl }`.
 *   2. Parent passes both to this component.
 *   3. When signing is complete / cancelled, DocuSign redirects the iframe to
 *      `returnUrl?event=signing_complete` (or other terminal event). We listen
 *      via `window.addEventListener("message", …)` for the postMessage that
 *      DocuSign's JS bridge fires, and also detect the URL change in the iframe
 *      via an `onLoad` handler on a wrapper element.
 *
 * Cockpit tokens only — no hex, no magic px.
 */

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type DocusignEvent =
  | "signing_complete"
  | "cancel"
  | "decline"
  | "session_timeout"
  | "ttl_expired"
  | "viewing_complete"
  | "exception";

export interface DocusignEmbeddedProps {
  /** DocuSign envelope GUID (persisted in SubscriptionEnvelope.envelopeId). */
  envelopeId: string;
  /**
   * URL to redirect the iframe to after the signing ceremony ends.
   * Must be registered as an allowed Return URL in the DocuSign account.
   */
  returnUrl: string;
  /**
   * One-time DocuSign embedded signing URL (expires — request it fresh each render).
   * Typically obtained from `createSubscriptionEnvelope()` server action.
   */
  signingUrl: string;
  /** Fired when the signer completes or exits the ceremony. */
  onEvent?: (event: DocusignEvent) => void;
  /** Optional extra className for the wrapper div. */
  className?: string;
}

const DOCUSIGN_EVENTS: DocusignEvent[] = [
  "signing_complete",
  "cancel",
  "decline",
  "session_timeout",
  "ttl_expired",
  "viewing_complete",
  "exception",
];

/**
 * Extract a `?event=<value>` param from an arbitrary URL string.
 * Returns null if the URL is invalid or the param is absent.
 */
function extractDocusignEvent(url: string): DocusignEvent | null {
  try {
    const parsed = new URL(url);
    const event = parsed.searchParams.get("event");
    if (event && (DOCUSIGN_EVENTS as string[]).includes(event)) {
      return event as DocusignEvent;
    }
  } catch {
    // Swallow — iframe src can be cross-origin or blob URLs we can't parse
  }
  return null;
}

export function DocusignEmbedded({
  envelopeId,
  returnUrl,
  signingUrl,
  onEvent,
  className,
}: DocusignEmbeddedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "done">(
    "loading",
  );

  // Listen for DocuSign postMessage events (the JS bridge approach).
  // DocuSign sends `{ messageType: "info", returnUrl: "…?event=signing_complete" }`.
  useEffect(() => {
    function handleMessage(evt: MessageEvent) {
      // Only handle objects with a `returnUrl` key (DocuSign shape)
      if (typeof evt.data !== "object" || evt.data === null) return;

      const data = evt.data as Record<string, unknown>;
      const url = typeof data.returnUrl === "string" ? data.returnUrl : null;
      if (!url) return;

      const docEvent = extractDocusignEvent(url);
      if (docEvent) {
        setStatus("done");
        onEvent?.(docEvent);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onEvent]);

  // Fallback: detect navigation inside the iframe via onLoad.
  // When DocuSign redirects to returnUrl, the iframe reloads and we can
  // inspect the new src (within same-origin policy constraints).
  function handleIframeLoad() {
    if (status === "loading") {
      setStatus("ready");
      return;
    }
    try {
      const iframeSrc = iframeRef.current?.contentWindow?.location.href;
      if (iframeSrc) {
        const docEvent = extractDocusignEvent(iframeSrc);
        if (docEvent) {
          setStatus("done");
          onEvent?.(docEvent);
        }
      }
    } catch {
      // Cross-origin — normal when DocuSign's own domain is loaded; ignore.
    }
  }

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg overflow-hidden",
        "ct-surface-0 border border-[var(--ct-border-soft)]",
        "shadow-[var(--ct-shadow-soft)]",
        className,
      )}
      data-envelope-id={envelopeId}
      data-testid="docusign-embedded"
    >
      {/* Loading overlay */}
      {status === "loading" && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--ct-bg-deep)]/80 backdrop-blur-sm"
          aria-live="polite"
          role="status"
        >
          <span className="body-sm ct-text-muted animate-pulse">
            Loading signing ceremony…
          </span>
        </div>
      )}

      {/* Completion overlay */}
      {status === "done" && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--ct-bg-deep)]/90 backdrop-blur-sm"
          aria-live="assertive"
          role="status"
        >
          <div className="flex flex-col items-center gap-3">
            <span className="h2 ct-text-primary">Done</span>
            <span className="body-sm ct-text-muted">
              Signing session completed.
            </span>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={`${signingUrl}&return_url=${encodeURIComponent(returnUrl)}`}
        title="DocuSign Subscription Agreement"
        onLoad={handleIframeLoad}
        allow="camera; microphone"
        className="w-full border-none ct-iframe-signing"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
