import { ProductPageHeader } from "@/components/connect/product-page-header";

interface PortfolioGreetingProps {
  name: string;
}

/**
 * Portfolio hub header: portfolio-specific styling on top of the shared
 * page-header skeleton so the hub keeps the same title/kicker/rule contract as
 * the other product surfaces.
 */
export function PortfolioGreeting({ name }: PortfolioGreetingProps) {
  return (
    <ProductPageHeader
      titleLead="Welcome back,"
      titleAccent={name}
      contextLabel="Portfolio overview"
      className="pf-greeting animate-in fade-in slide-in-from-top-2 duration-700 ease-out"
    />
  );
}
