"use client";

import { useEffect } from "react";

/**
 * Pose un attribut sur <html> tant qu'une page Portfolio "feuille blanche" est
 * montée, puis le retire au démontage. Sert UNIQUEMENT à neutraliser le canvas
 * DS (.ct-page-area : fond #191B22 + dot-grid) via le sélecteur
 * `html[data-blank-canvas] .ct-page-area` — fiable même quand le contenu est
 * rendu hors de .ct-page-area par le bailout next/dynamic du shell (le :has()
 * sur un marqueur descendant ne matchait pas dans ce cas).
 */
export function BlankCanvasMarker() {
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-blank-canvas", "");
    return () => {
      el.removeAttribute("data-blank-canvas");
    };
  }, []);
  return null;
}
