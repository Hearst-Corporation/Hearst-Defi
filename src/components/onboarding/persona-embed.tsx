"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { claimKycInquiry } from "@/lib/onboarding/actions";
import { cn } from "@/lib/cn";

interface PersonaSdkOptions {
  templateId: string;
  environment: "sandbox" | "production";
  referenceId?: string;
  onReady?: (inquiryId: string) => void;
  onComplete?: (data: { inquiryId: string; status: string }) => void;
  onCancel?: () => void;
  onError?: (error: { code: string; message: string }) => void;
}

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
  templateId: string;
  environment: "sandbox" | "production";
  referenceId?: string;
  onComplete?: (data: { inquiryId: string; status: string }) => void;
  onCancel?: () => void;
  className?: string;
}

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
  const claimedInquiriesRef = useRef<Set<string>>(new Set());

  async function claimInquiryOnce(inquiryId: string): Promise<void> {
    if (!inquiryId || claimedInquiriesRef.current.has(inquiryId)) return;
    claimedInquiriesRef.current.add(inquiryId);
    try {
      await claimKycInquiry(inquiryId);
    } catch (err) {
      claimedInquiriesRef.current.delete(inquiryId);
      console.error("[persona-embed] claimKycInquiry failed:", err);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.Persona) {
      const id = setTimeout(() => setSdkReady(true), 0);
      return () => clearTimeout(id);
    }

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
      onReady: (inquiryId) => {
        void claimInquiryOnce(inquiryId);
      },
      onComplete: (data) => {
        setLoading(false);
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
    <div className={cn("product-doc-stack--actions", className)}>
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!sdkReady || loading}
        onClick={handleLaunch}
      >
        {loading ? "Verifying…" : "Begin identity verification"}
      </Button>

      {error !== null ? (
        <p role="alert" className="body-xs ct-status-danger m-0">
          {error}
        </p>
      ) : null}
    </div>
  );
}
