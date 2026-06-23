interface PortfolioGreetingProps {
  name: string;
}

/**
 * Portfolio hub header: greeting minimaliste.
 */
export function PortfolioGreeting({ name }: PortfolioGreetingProps) {
  return (
    <header className="pf-greeting">
      <div className="pf-greeting__lead min-w-0">
        <h1 className="h1 m-0">
          Welcome back, <span className="pf-greeting-name">{name}</span>
        </h1>
        <p className="pf-greeting__sub m-0">
          <span className="pf-greeting__sub-dot" />
          Portfolio cockpit
        </p>
      </div>
    </header>
  );
}
