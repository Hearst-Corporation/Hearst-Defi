"use client";

// Lazy client wrapper for DistributionChart (recharts). The portfolio page is a
// Server Component and this chart is UNDER-THE-FOLD on the hottest investor route,
// so we code-split recharts out of the route's entry chunk AND skip its SSR pass
// (ssr:false is legal here because THIS module is a Client Component, not the
// Server page — Next 16 forbids ssr:false only inside Server Components).
// FINDING #18 (P1, perf): better TTI/LCP, zero visual regression.

import dynamic from "next/dynamic";

import type { DistributionChartProps } from "@/components/portfolio/distribution-chart";

// Height mirrors DistributionChart's own `h-[180px]` so the skeleton reserves the
// exact box and there is no layout shift when recharts hydrates in.
const DistributionChart = dynamic(
  () =>
    import("@/components/portfolio/distribution-chart").then(
      (m) => m.DistributionChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="mt-4 h-[180px] w-full animate-pulse rounded-xl bg-[var(--ct-surface-inset)]"
        role="status"
        aria-label="Loading distribution chart"
      />
    ),
  },
);

export function DistributionChartLazy(props: DistributionChartProps) {
  return <DistributionChart {...props} />;
}
