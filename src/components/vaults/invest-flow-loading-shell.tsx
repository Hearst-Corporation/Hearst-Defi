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
        "invest-flow-shell animate-in fade-in vault-flow-loading-fade",
        width === "cap" && "product-doc-shell--cap",
        width === "narrow" && "product-doc-shell--narrow",
        workspace && "invest-flow-shell--workspace",
      )}
      aria-busy="true"
      aria-label="Loading invest flow"
    >
      <header className="product-page-header">
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
            <div className="product-page-header__actions flex flex-wrap gap-[var(--ct-space-2)]">
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          ) : null}
        </div>
        <div className="invest-flow-shell__stepper">
          <Skeleton className="h-2 w-full max-w-md" />
        </div>
        {showKpiRow ? (
          <dl className="vault-detail-overview__kpis">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="vault-detail-overview__kpi">
                <Skeleton className="h-3 w-24" variant="text" />
                <Skeleton className="mt-[var(--ct-space-2)] h-6 w-28" />
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <div className="invest-flow-shell__body">
        {showOverview ? (
          <section className="vault-detail-overview" aria-hidden>
            <dl className="vault-detail-overview__kpis">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="vault-detail-overview__kpi">
                  <Skeleton className="h-3 w-24" variant="text" />
                  <Skeleton className="mt-[var(--ct-space-2)] h-7 w-28" />
                </div>
              ))}
            </dl>
            <div className="vault-detail-overview__cta">
              <Skeleton className="h-10 w-44" />
            </div>
          </section>
        ) : null}

        {bodySections > 0 ? (
          <div className="invest-flow-detail__grid">
            <div className="invest-flow-detail__primary product-doc-stack">
              {Array.from({ length: bodySections }).map((_, index) => (
                <FlatSectionSkeleton key={index} />
              ))}
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
