import { ChartGallery } from "@/components/admin/product-workspace/chart-gallery";
import { MonteCarloChart } from "@/components/admin/product-workspace/monte-carlo-chart";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chart Gallery — Hearst Connect",
};

/**
 * /admin/chart-gallery — every chart candidate in one place so we can classify
 * and pick which ones get wired to real vault data. Recharts (shadcn-on-DS) +
 * a seeded Chart.js Monte-Carlo. Demo data only.
 *
 * Plain SCROLLABLE page (no AdminPageShell no-scroll frame, no AdminSectionCard
 * wrapper) — each chart already carries its own Card, so there are NO boxes in
 * boxes. Generous bottom margin so the last chart clears the floating bottom bar.
 */
export default function ChartGalleryPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-(--ct-space-8) p-(--ct-space-8) pb-(--ct-space-32)">
        <header className="flex flex-col gap-(--ct-space-1)">
          <h1 className="text-[length:var(--ct-text-3xl)] font-semibold tracking-tight ct-text-strong">
            Chart <span className="ct-text-accent">Gallery</span>
          </h1>
          <p className="ct-metric-caption ct-text-muted">
            Recharts (shadcn on the DS) + a seeded Chart.js Monte-Carlo · demo data.
          </p>
        </header>

        {/* Recharts cards — each is its own Card, no outer box. */}
        <ChartGallery />

        {/* Monte-Carlo — already wrapped in its own Card inside the component. */}
        <MonteCarloChart
          seed={1878790276}
          renderedPaths={220}
          horizonMonths={120}
          expectedAnnualReturn={0.07}
          annualVolatility={0.15}
        />
      </div>
    </div>
  );
}
