"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Implémentation réelle du Toaster (sonner).
 *
 * Séparée de `./toast` pour que ce dernier puisse la charger en `next/dynamic`
 * avec `ssr: false` : montée statiquement dans le layout racine, sonner entrait
 * dans le First Load des 62 routes — y compris `/login` et `/legal/*`, qui
 * n'émettent jamais un toast. Le rendu est inchangé.
 */
export function ToasterImpl() {
  return (
    <Sonner
      theme="dark"
      richColors={false}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "border border-border bg-surface-raised text-foreground shadow-[var(--ct-shadow-soft)]",
          title: "text-sm font-medium",
          description: "text-sm text-muted",
          actionButton: "bg-accent text-accent-foreground",
          cancelButton: "bg-surface-overlay text-muted",
        },
      }}
    />
  );
}
