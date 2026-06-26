/**
 * Portfolio hub header — institutional titanium strip (no personalized greeting).
 */
export function PortfolioGreeting() {
  return (
    <header className="pf-greeting animate-in fade-in slide-in-from-top-2 duration-700 ease-out">
      <div className="pf-greeting__lead min-w-0">
        <h1 className="h1 m-0">PORTFOLIO</h1>
        <p className="pf-greeting__sub m-0">
          <span className="pf-greeting__sub-dot" aria-hidden="true" />
          Institutional cockpit
          <span aria-hidden="true"> · </span>
          Verified data feeds
        </p>
      </div>
    </header>
  );
}
