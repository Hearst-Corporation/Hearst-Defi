import { cn } from "@/lib/cn";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

type InvestFlowLoadingShellProps = {
  width?: "cap" | "narrow" | "full";
  workspace?: boolean;
  showActions?: boolean;
  showKpiRow?: boolean;
  showLead?: boolean;
  bodyCards?: number;
};

export function InvestFlowLoadingShell({
  width = "cap",
  workspace = false,
  showActions = false,
  showKpiRow = false,
  showLead = false,
  bodyCards = 1,
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
              <Skeleton className="hidden h-9 w-44 lg:block" />
            </div>
          ) : null}
        </div>
        <div className="invest-flow-shell__stepper">
          <Skeleton className="h-2 w-full max-w-md" />
        </div>
        {showKpiRow ? (
          <dl className="vault-detail-kpis">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="h-3 w-24" variant="text" />
                <Skeleton className="mt-[var(--ct-space-2)] h-6 w-28" />
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <div className="invest-flow-shell__body">
        <div className="product-doc-stack">
          {Array.from({ length: bodyCards }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
