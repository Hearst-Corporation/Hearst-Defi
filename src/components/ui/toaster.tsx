"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Global toast notification provider.
 *
 * Place this inside the root layout. Uses Sonner for lightweight,
 * beautiful toast notifications with dark-mode support out of the box.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      richColors
      toastOptions={{
        style: {
          background: "var(--ct-surface-inset)",
          color: "var(--ct-text-primary)",
          border: "1px solid var(--ct-border)",
          backdropFilter: "blur(40px) saturate(110%)",
        },
      }}
    />
  );
}
