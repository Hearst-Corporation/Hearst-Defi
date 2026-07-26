"use client";

import dynamic from "next/dynamic";

/**
 * Toaster global — chargé à la demande.
 *
 * `ssr: false` sort sonner du First Load : le layout racine l'importait
 * statiquement, donc les 62 routes le payaient, y compris celles qui n'émettent
 * jamais de toast. Les toasts sont déclenchés par une action utilisateur, jamais
 * au premier paint : le chunk a tout le temps d'arriver.
 *
 * L'export s'appelle toujours `Toaster` — les 23 importeurs de `@/ui` sont
 * inchangés, et le rendu est identique (voir ./toast-impl).
 */
const ToasterImpl = dynamic(
  () => import("./toast-impl").then((m) => m.ToasterImpl),
  { ssr: false },
);

export function Toaster() {
  return <ToasterImpl />;
}
