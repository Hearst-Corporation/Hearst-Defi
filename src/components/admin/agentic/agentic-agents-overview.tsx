// Admin · Agentic Control Tower — Agents & Crews overview (presentational).
//
// READ-ONLY. The agent / logic inventory grouped BY DOMAIN into compact lanes —
// not 22 equal full-width cards. Each domain shows its agents as compact rows
// with a write/gate marker, so an admin can scan "who exists" by area without a
// documentation wall. Pure component; data passed in, SSR-testable.

import type {
  AgenticControlCenterData,
  AgenticInventoryItem,
} from "@/lib/agentic/control-center/types";

/** Display order + friendly labels for the inventory domains. */
const DOMAIN_LABEL: Record<string, string> = {
  chat: "Chat",
  routing: "Routing",
  compliance: "Compliance",
  tools: "Tools",
  outreach: "Outreach",
  scenario: "Scenario & Risk",
  reporting: "Reporting",
  memory: "Memory",
  product: "Product",
  vault: "Vault",
  canvas: "Canvas",
  observability: "Observability",
};

const DOMAIN_ORDER = [
  "chat",
  "routing",
  "compliance",
  "tools",
  "outreach",
  "scenario",
  "reporting",
  "product",
  "vault",
  "memory",
  "canvas",
  "observability",
];

/** Plain-language capability marker for one inventory item. */
function capability(item: AgenticInventoryItem): string {
  if (!item.writesAllowed) return "reads only";
  if (item.humanGateRequired) return "writes — gated";
  return "writes";
}

function capabilityTone(item: AgenticInventoryItem): "success" | "warning" | "danger" {
  if (!item.writesAllowed) return "success";
  if (item.humanGateRequired) return "warning";
  return "danger";
}

export function AgenticAgentsOverview({
  controlCenter,
}: {
  controlCenter: AgenticControlCenterData | null | undefined;
}) {
  if (!controlCenter) return null;
  const inventory = controlCenter.inventory;

  // Group by domain, preserving the display order; unknown domains go last.
  const byDomain = new Map<string, AgenticInventoryItem[]>();
  for (const item of inventory) {
    const list = byDomain.get(item.domain) ?? [];
    list.push(item);
    byDomain.set(item.domain, list);
  }
  const domains = [
    ...DOMAIN_ORDER.filter((d) => byDomain.has(d)),
    ...[...byDomain.keys()].filter((d) => !DOMAIN_ORDER.includes(d)),
  ];

  const writeCount = inventory.filter((i) => i.writesAllowed).length;
  const gatedCount = inventory.filter((i) => i.writesAllowed && i.humanGateRequired).length;

  return (
    <section id="agents-overview" className="agentic-stack" aria-label="Agents and crews">
      <div className="agentic-section-head">
        <h2 className="agentic-section-title m-0">Agents &amp; Crews</h2>
        <p className="body-sm ct-text-muted m-0">
          {inventory.length} logic units across {domains.length} domains.{" "}
          {inventory.length - writeCount} read-only; {gatedCount} of the {writeCount} that can
          write are human-gated. Grouped by area, not as one long list.
        </p>
      </div>

      <div className="agentic-agents-grid">
        {domains.map((domain) => {
          const items = byDomain.get(domain) ?? [];
          return (
            <div key={domain} className="agentic-agents-lane">
              <div className="agentic-agents-lane-head">
                <span className="agentic-agents-lane-title">
                  {DOMAIN_LABEL[domain] ?? domain}
                </span>
                <span className="ct-text-faint tabular-nums">{items.length}</span>
              </div>
              <ul className="agentic-agents-list">
                {items.map((item) => (
                  <li key={item.id} className="agentic-agents-row">
                    <span className="body-xs ct-text-body flex-1 break-words">{item.name}</span>
                    <span
                      className="agentic-agents-cap"
                      data-tone={capabilityTone(item)}
                    >
                      {capability(item)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
