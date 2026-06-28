import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared header for the /portfolio leaf pages (positions / yield / activity /
 * distributions / tax / [positionId]). Mirrors the main /portfolio header on the
 * DS canon: back link → bicolor H1 → kicker → accent rule. Token-only.
 */
export function PortfolioLeafHeader({
  titleLead,
  titleAccent,
  kicker,
  trailing,
}: {
  titleLead: string;
  titleAccent?: string;
  kicker?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 pb-3">
      <Link
        href="/portfolio"
        className="ct-metric-caption w-fit transition-colors hover:text-[var(--ct-text-strong)]"
      >
        ← Portfolio
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="h1 shrink-0">
            {titleLead}
            {titleAccent ? (
              <>
                {" "}
                <span className="h1-accent">{titleAccent}</span>
              </>
            ) : null}
          </h1>
          {kicker ? <p className="page-canon-kicker">{kicker}</p> : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      <div className="page-canon-rule" aria-hidden="true" />
    </header>
  );
}
