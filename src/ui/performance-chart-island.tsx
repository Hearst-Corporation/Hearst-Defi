"use client";

import dynamic from "next/dynamic";

import type { PerformanceChartProps } from "@/ui/chart";

/**
 * Îlot de chargement du graphique de performance.
 *
 * POURQUOI CE FICHIER EXISTE
 * `@/ui/chart` est `"use client"` et importe Recharts, qui traîne
 * @reduxjs/toolkit, react-redux, immer, reselect et victory-vendor. Importé
 * statiquement depuis la vue serveur, il entrait dans le bundle initial de
 * `/portfolio` — mesuré : +123 kB gz et Recharts de 1 à 3 chunks.
 *
 * `ssr: false` est INTERDIT depuis un Server Component en Next 16, d'où ce
 * fichier client dédié qui ne contient que le `dynamic()` et son squelette.
 *
 * Pourquoi `ssr: false` ne fait pas clignoter : `ResponsiveContainer` mesure au
 * montage, donc un rendu serveur de Recharts produit un SVG à dimensions
 * nulles — il n'y a rien à faire disparaître. Ce qui provoque un saut de mise
 * en page, c'est l'absence de réservation de hauteur ; le `loading` ci-dessous
 * occupe EXACTEMENT la boîte finale.
 */
const PerformanceChartImpl = dynamic(
  () => import("@/ui/chart").then((m) => m.PerformanceChart),
  {
    ssr: false,
    loading: () => (
      <div
        // Même hauteur que le graphique rendu : CLS = 0.
        style={{ height: 300 }}
        className="w-full animate-pulse rounded-xl bg-surface-raised"
        aria-hidden
      />
    ),
  },
);

export function PerformanceChartIsland(props: PerformanceChartProps) {
  return <PerformanceChartImpl {...props} />;
}
