// Admin · Agentic Control Tower — Agents & Crews (presentational).
//
// READ-ONLY. Canon migration (Mission #064): the agent / logic inventory grouped
// by domain inside the parent AdminSectionCard. Each domain is a FLAT block (no
// border/radius/inset sub-surface — no cage-in-cage): a domain header row
// separated from its agent lines and from the other domains by hairlines only.
// Capability renders as a canon BentoBadge. No hardcoded colour outside the canon
// (--ct-accent). Pure component.

import { Fragment } from "react";

import { BentoBadge } from "@/components/catalyst/bento-badge";
import type {
  AgenticControlCenterData,
  AgenticInventoryItem,
} from "@/lib/agentic/control-center/types";

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

type CapabilityVariant = "success" | "warning" | "danger";

function capability(item: AgenticInventoryItem): string {
  if (!item.writesAllowed) return "reads only";
  if (item.humanGateRequired) return "writes — gated";
  return "writes";
}

function capabilityVariant(item: AgenticInventoryItem): CapabilityVariant {
  if (!item.writesAllowed) return "success";
  if (item.humanGateRequired) return "warning";
  return "danger";
}

function CapabilityTag({ item }: { item: AgenticInventoryItem }) {
  return <BentoBadge variant={capabilityVariant(item)}>{capability(item)}</BentoBadge>;
}

export function AgenticAgentsOverview({
  controlCenter,
}: {
  controlCenter: AgenticControlCenterData | null | undefined;
}) {
  if (!controlCenter) return null;
  const inventory = controlCenter.inventory;

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
  const gatedCount = inventory.filter(
    (i) => i.writesAllowed && i.humanGateRequired,
  ).length;

  return (
    <div className="flex min-w-0 flex-col">
      <p className="ct-metric-caption border-b border-[var(--ct-border-soft)] px-5 py-3">
        {`${inventory.length} units · ${domains.length} domains · ${inventory.length - writeCount} read-only · ${gatedCount} gated write${gatedCount !== 1 ? "s" : ""}.`}
      </p>

      <div className="grid grid-cols-1 gap-x-8 px-5 lg:grid-cols-2">
        {domains.map((domain) => {
          const items = byDomain.get(domain) ?? [];
          return (
            <div key={domain} className="flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] py-3">
                <span className="ct-bento-label">
                  {DOMAIN_LABEL[domain] ?? domain}
                </span>
                <span className="text-[length:var(--ct-text-micro)] font-bold tabular-nums text-[var(--ct-text-faint)]">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col pb-3">
                {items.map((item) => (
                  <Fragment key={item.id}>
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] py-3 last:border-b-0">
                      <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]">
                        {item.name}
                      </span>
                      <CapabilityTag item={item} />
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
