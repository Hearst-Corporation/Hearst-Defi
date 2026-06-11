"use client";

import { useState } from "react";

interface CopyAddressButtonProps {
  address: string;
}

/**
 * Minimal client component: copies `address` to the clipboard via
 * navigator.clipboard.writeText and shows a transient "Copied" label.
 */
export function CopyAddressButton({ address }: CopyAddressButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    } catch {
      // Clipboard API unavailable (non-https / permissions denied) — silent.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="body-xs ct-text-muted border border-[var(--ct-border-soft)] rounded-sm px-2 py-1 hover:ct-text-primary hover:border-[var(--ct-border-strong)] transition-colors shrink-0"
      aria-label="Copy vault contract address"
    >
      {copied ? "Copied" : "copy"}
    </button>
  );
}
