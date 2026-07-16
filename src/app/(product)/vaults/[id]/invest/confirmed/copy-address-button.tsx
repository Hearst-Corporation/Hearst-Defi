"use client";

import { useRef, useState } from "react";

import { CockpitButton } from "@/components/catalyst/cockpit-button";

interface CopyAddressButtonProps {
  address: string;
}

const COPY_RESET_MS = 2000;

export function CopyAddressButton({ address }: CopyAddressButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      setCopied(true);
      resetTimerRef.current = setTimeout(() => setCopied(false), COPY_RESET_MS);
    } catch {
      // Clipboard API unavailable (non-https / permissions denied) — silent.
    }
  }

  return (
    <CockpitButton
      type="button"
      onClick={handleCopy}
      variant="outline"
      shape="rect"
      className="ct-copy-chip"
      aria-label="Copy vault contract address"
    >
      {copied ? "Copied" : "copy"}
    </CockpitButton>
  );
}
