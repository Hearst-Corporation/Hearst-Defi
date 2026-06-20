import type { ReactNode } from "react";

/**
 * Shared chrome for the portfolio "view more" leaf pages
 * (/portfolio/positions, /yield, /distributions, /activity).
 *
 * Renders the same `.pf-container` shell the dashboard uses,
 * so every leaf inherits identical chrome without each page re-declaring it.
 * Leaf pages are NOT the no-scroll top level — they may scroll.
 */
export function PortfolioLeafShell({
  testId,
  header,
  children,
}: {
  testId: string;
  /** Optional ProductPageHeader (eyebrow + H1 + description) for this leaf. */
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pf-container" data-testid={testId}>
      {header}
      {children}
    </div>
  );
}
