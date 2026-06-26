"use client";

import { useEffect } from "react";

/**
 * Cleanup-only : RETIRE `data-blank-canvas` de <html> au démontage du layout
 * portfolio (navigation client vers vaults/profile/proof). L'attribut est POSÉ
 * avant le paint par le <script> inline du layout portfolio (anti-flash) ; ici
 * on garantit juste qu'il disparaît quand on quitte portfolio, sinon le canvas
 * des autres pages produit resterait neutralisé à tort.
 */
export function BlankCanvasMarker() {
  useEffect(() => {
    // Idempotent : si le script inline n'a pas tourné (edge), on le pose aussi.
    document.documentElement.setAttribute("data-blank-canvas", "");
    return () => {
      document.documentElement.removeAttribute("data-blank-canvas");
    };
  }, []);
  return null;
}
