interface PortfolioGreetingProps {
  /** Display name — email local-part or shortened wallet. */
  name: string;
}

/**
 * Welcome line above the cockpit. Server Component, tokens/classes only.
 */
export function PortfolioGreeting({ name }: PortfolioGreetingProps) {
  return (
    <div className="pf-greeting">
      <h1 className="h1">
        Welcome back, <span className="pf-greeting-name">{name}</span>
      </h1>
    </div>
  );
}
