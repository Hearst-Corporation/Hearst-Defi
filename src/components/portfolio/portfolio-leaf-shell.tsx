import type { ReactNode } from "react";

import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { cn } from "@/lib/cn";

/**
 * Shared chrome for the portfolio "view more" leaf pages
 * (/portfolio/positions, /yield, /distributions, /activity).
 *
 * Renders the same `.pf-container` shell + demo-data banner the dashboard uses,
 * so every leaf inherits identical preview/demo honesty chrome without each page
 * re-declaring it. Leaf pages are NOT the no-scroll top level — they may scroll.
 */
export function PortfolioLeafShell({
  demo,
  showDemoBanner,
  previewZeros,
  testId,
  header,
  children,
}: {
  demo: boolean;
  showDemoBanner: boolean;
  previewZeros: boolean;
  testId: string;
  /** Optional ProductPageHeader (eyebrow + H1 + description) for this leaf. */
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("pf-container", previewZeros && "pf-container--zero")}
      data-testid={testId}
    >
      {demo ? (
        <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} />
      ) : showDemoBanner ? (
        <DemoDataBanner />
      ) : null}

      {header}
      {children}
    </div>
  );
}
