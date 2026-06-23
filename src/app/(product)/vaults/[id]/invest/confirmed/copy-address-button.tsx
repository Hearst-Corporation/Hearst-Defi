"use client";

import { useRef, useState } from "react";

interface CopyAddressButtonProps {
  address: string;
}

export function CopyAddressButton({ address }: CopyAddressButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      setCopied(true);
      resetTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-https / permissions denied) — silent.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ct-copy-chip"
      aria-label="Copy vault contract address"
    >
      {copied ? "Copied" : "copy"}
    </button>
  );
}
