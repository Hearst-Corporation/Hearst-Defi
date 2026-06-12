"use client";

import { useHubMode } from "@hearst/hub-sdk";

// ---------------------------------------------------------------------------
// Contrat hub-mode Phase A — embarqué dans le hub Hearst (?hub=1 / window.hearstHub)
// Connect masque son propre chrome (header nav flottant, ambient orbs)
// pour ne pas doubler le chrome du hub. Standalone (isHub===false) : no-op strict.
//
// WHY backdrop-filter → none :
// Dans un guest <webview> Electron, Chromium ne peut pas résoudre
// backdrop-filter:blur, -webkit-backdrop-filter, ni mask-image correctement →
// zones noires/vides. On neutralise .ct-glass-panel qui porte ces propriétés.
//
// Accent couleur Connect : see CT_PRODUCT_CONNECT_HEX in src/lib/cockpit-tokens.ts
// ---------------------------------------------------------------------------

export function HubModeStyles() {
  const { isHub } = useHubMode();
  if (!isHub) return null;
  return (
    <style>{`
      /* ── Chrome Connect : header nav + ambient orbs masqués ── */
      header.sticky { display: none !important; }

      /* ── Ambient background orbs (filter/blur → compositing webview) ── */
      .fixed.inset-0.pointer-events-none.z-0 { display: none !important; }

      /* ── Shell Cockpit : rails + bottombar neutralisés en hub-mode ── */
      [data-cockpit-shell],
      .ct-rail-left,
      .ct-rail-right,
      .ct-bottom-bar { display: none !important; }

      /* ── Page area : pleine largeur sans rails ── */
      .ct-page-area {
        margin-left: 0 !important;
        margin-right: 0 !important;
        padding-bottom: 0 !important;
      }

      /* ── Main : padding-top compensatoire (header masqué, espace libéré) ── */
      main#main-content { padding-top: 0 !important; margin-top: 0 !important; }

      /* ── backdrop-filter → none (webview compositing Electron) ── */
      .ct-glass-panel,
      .ct-card {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: var(--ct-bg-deep) !important;
      }

      /* ── backdrop-blur Tailwind → none ── */
      .backdrop-blur-2xl,
      .backdrop-blur-xl,
      .backdrop-blur-lg,
      .backdrop-blur-md,
      .backdrop-blur-sm,
      .backdrop-blur {
        --tw-backdrop-blur: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      /* ── blur() sur les orbs (filter:blur) ── */
      [class*="blur-"] { filter: none !important; }

      /* ── mask-image / -webkit-mask-image ── */
      [style*="mask-image"],
      [style*="-webkit-mask-image"] {
        mask-image: none !important;
        -webkit-mask-image: none !important;
      }

      /* ── preserve-3d → flat (stacking context cassé en guest webview) ── */
      .preserve-3d { transform-style: flat !important; }
      .perspective-scene { perspective: none !important; }
    `}</style>
  );
}
