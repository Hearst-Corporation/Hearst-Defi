import { cn } from "@/lib/cn";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

type InvestFlowLoadingShellProps = {
  width?: "cap" | "narrow" | "full";
  workspace?: boolean;
  showActions?: boolean;
  /** @deprecated KPIs live in the overview band — use showOverview */
  showKpiRow?: boolean;
  showLead?: boolean;
  /** Overview hero band skeleton (vault detail page). */
  showOverview?: boolean;
  bodyCards?: number;
  /** Flat section placeholders (no Card chrome). */
  bodySections?: number;
};

function FlatSectionSkeleton() {
  return (
    <div className="vault-detail-block">
      <Skeleton className="h-6 w-40" variant="text" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function KpisSkeleton({ height = "h-6" }: { height?: string }) {
  return (
    <dl className="vault-detail-overview__kpis">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="vault-detail-overview__kpi">
          <Skeleton className="h-3 w-24" variant="text" />
          <Skeleton className={cn("mt-(--ct-space-3) w-32", height)} />
        </div>
      ))}
    </dl>
  );
}

export function InvestFlowLoadingShell({
  width = "cap",
  workspace = false,
  showActions = false,
  showKpiRow = false,
  showLead = false,
  showOverview = false,
  bodyCards = 0,
  bodySections = 0,
}: InvestFlowLoadingShellProps) {
  return (
    <div
      className={cn(
        "product-doc-stack animate-in fade-in vault-flow-loading-fade",
        width === "cap" && "product-doc-shell--cap",
        width === "narrow" && "product-doc-shell--narrow",
        workspace && "invest-flow-shell--workspace",
      )}
      aria-busy="true"
      aria-label="Loading invest flow"
    >
      <header className="product-page-header mb-0">
        <div className="product-page-header__row">
          <div className="product-page-header__main">
            <div className="product-page-header__title-stack">
              {showLead ? <Skeleton className="h-4 w-28" variant="text" /> : null}
              <Skeleton className="h-3 w-36" variant="text" />
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-4 w-full max-w-xl" variant="text" />
            </div>
          </div>
          {showActions ? (
            <div className="product-page-header__actions flex flex-wrap gap-(--ct-space-2)">
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          ) : null}
        </div>
        <div className="invest-flow-shell__stepper">
          <Skeleton className="h-2 w-full max-w-md" />
        </div>
        {showKpiRow ? <KpisSkeleton height="h-6" /> : null}
      </header>

      <div className="invest-flow-shell__body">
        {showOverview ? (
          <section className="vault-detail-overview" aria-hidden>
            <div className="vault-detail-overview__main">
              <KpisSkeleton height="h-8" />
            </div>
            <div className="vault-detail-overview__cta">
              <Skeleton className="h-12 w-48 rounded-lg" />
            </div>
          </section>
        ) : null}

        {bodySections > 0 ? (
          <div className={cn(showOverview ? "invest-flow-detail__grid" : "vault-invest-grid")}>
            <div className={cn(showOverview ? "invest-flow-detail__primary" : "vault-invest-form-main", "product-doc-stack")}>
              {Array.from({ length: bodySections }).map((_, index) => (
                <FlatSectionSkeleton key={index} />
              ))}
            </div>
            <div className={cn(showOverview ? "invest-flow-detail__secondary" : "vault-invest-grid__rail", "product-doc-stack")}>
              <div className="vault-detail-block">
                <Skeleton className="h-6 w-32 mb-8" variant="text" />
                <div className="flex gap-12 items-center">
                  <Skeleton className="h-44 w-44 rounded-full shrink-0" />
                  <div className="flex-1 flex flex-col gap-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              </div>
              <div className="vault-detail-block">
                <Skeleton className="h-6 w-32 mb-8" variant="text" />
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            </div>
          </div>
        ) : null}

        {bodyCards > 0 ? (
          <div className="product-doc-stack">
            {Array.from({ length: bodyCards }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
