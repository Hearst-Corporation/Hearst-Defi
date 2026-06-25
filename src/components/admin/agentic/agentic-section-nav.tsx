// Admin · Agentic Control Tower — Section navigation (sticky, presentational).
//
// READ-ONLY. A sticky internal nav of in-page anchor links so the admin can jump
// between the tower sections without scrolling a documentation wall. Plain <a>
// anchors only — no client JS, no actions, no write controls. Pure component.

export interface AgenticNavItem {
  href: string;
  label: string;
}

/** The tower's section anchors, in render order. */
export const AGENTIC_NAV_ITEMS: AgenticNavItem[] = [
  { href: "#overview", label: "Overview" },
  { href: "#topology", label: "Topology" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#agents-overview", label: "Agents & Crews" },
  { href: "#action-readiness", label: "Actions & Gates" },
  { href: "#crew-simulation", label: "Simulations" },
  { href: "#router-observability", label: "Observability" },
  { href: "#safety-boundary", label: "Safety Boundary" },
];

export function AgenticSectionNav({
  items = AGENTIC_NAV_ITEMS,
}: {
  items?: AgenticNavItem[];
}) {
  return (
    <nav className="agentic-nav" aria-label="Agentic console sections">
      <ul className="agentic-nav-list">
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} className="agentic-nav-link">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
