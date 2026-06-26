"use client";

/**
 * Grille de calibrage "bataille navale" — outil DEV uniquement.
 *
 * Pose un quadrillage par-dessus la SECTION CENTRALE et le CHAT (rail droit) :
 *  - colonnes étiquetées par lettres (A, B, C, …) en haut
 *  - lignes étiquetées par chiffres (1, 2, 3, …) à gauche
 *  - pas de grille fixe (CELL px) + lignes majeures tous les MAJOR cells
 *  - règles de bord avec les distances (px depuis le bord)
 *
 * `position: fixed` + `pointer-events: none` → la grille flotte AU-DESSUS de
 * tout (y compris les box/surfaces), elle ne disparaît jamais derrière une box.
 * Se cale sur les zones via les variables de rail du shell (--ct-rail-left,
 * --ct-rail-right-eff). Activable/désactivable (touche "g") — n'apparaît jamais
 * en production.
 */

import { useEffect, useState } from "react";

const CELL = 32; // taille d'une cellule (px)
const MAJOR = 4; // ligne majeure tous les 4 cells (128px)

function letters(n: number): string {
  // 0→A, 25→Z, 26→AA…
  let s = "";
  let i = n;
  do {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
}

function GridZone({ label }: { label: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  return (
    <div
      ref={(el) => {
        if (el && !size) {
          const r = el.getBoundingClientRect();
          setSize({ w: r.width, h: r.height });
        }
      }}
      className="dev-grid__zone"
    >
      {/* Quadrillage (lignes fines + majeures) via background répété */}
      <div className="dev-grid__lines" />

      {size ? (
        <>
          {/* Étiquettes colonnes (lettres) en haut */}
          <div className="dev-grid__cols">
            {Array.from({ length: Math.ceil(size.w / CELL) }).map((_, c) => (
              <span
                key={c}
                className={`dev-grid__col${c % MAJOR === 0 ? " is-major" : ""}`}
                style={{ left: c * CELL }}
              >
                {letters(c)}
              </span>
            ))}
          </div>
          {/* Étiquettes lignes (chiffres) à gauche */}
          <div className="dev-grid__rows">
            {Array.from({ length: Math.ceil(size.h / CELL) }).map((_, r) => (
              <span
                key={r}
                className={`dev-grid__row${r % MAJOR === 0 ? " is-major" : ""}`}
                style={{ top: r * CELL }}
              >
                {r + 1}
              </span>
            ))}
          </div>
          {/* Règles de bord : dimensions de la zone */}
          <span className="dev-grid__dim dev-grid__dim--w">
            {Math.round(size.w)}px · {Math.ceil(size.w / CELL)} cols
          </span>
          <span className="dev-grid__dim dev-grid__dim--h">
            {Math.round(size.h)}px · {Math.ceil(size.h / CELL)} rows
          </span>
          <span className="dev-grid__tag">{label}</span>
        </>
      ) : null}
    </div>
  );
}

export function GridOverlay() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        const typing =
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable);
        if (!typing) setOn((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!on) return null;

  return (
    <div className="dev-grid" aria-hidden>
      <div className="dev-grid__center">
        <GridZone label="CENTRE" />
        {/* Ligne verte verticale au milieu de la largeur du cadre central. */}
        <div className="dev-grid__midline" />
      </div>
      <div className="dev-grid__chat">
        <GridZone label="CHAT" />
      </div>
      <div className="dev-grid__hint">grille dev · touche “g” pour masquer</div>
    </div>
  );
}
