// Admin · Agentic Control Tower — Agents & Crews (presentational).
//
// READ-ONLY. Bento conversion 2026-06-28: the agent / logic inventory as a
// black BentoPanel, grouped by domain. Each domain is a #15191C sub-surface
// (sub-header row + one dense line per agent: name · capability), not 22 equal
// cards. No hardcoded colour outside the canon (--ct-accent). Pure component.

import { Fragment } from "react";
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

type Tone = "ok" | "warn" | "danger";

function capability(item: AgenticInventoryItem): string {
  if (!item.writesAllowed) return "reads only";
  if (item.humanGateRequired) return "writes — gated";
  return "writes";
}

function capabilityTone(item: AgenticInventoryItem): Tone {
  if (!item.writesAllowed) return "ok";
  if (item.humanGateRequired) return "warn";
  return "danger";
}

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-[var(--ct-accent)]",
  warn: "bg-[var(--ct-status-warning)]",
  danger: "bg-[var(--ct-status-danger)]",
};

const TAG_CLASS: Record<Tone, string> = {
  ok: "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]",
  warn: "border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] text-[var(--ct-status-warning)]",
  danger: "border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] text-[var(--ct-status-danger)]",
};

function CapabilityTag({ item }: { item: AgenticInventoryItem }) {
  const tone = capabilityTone(item);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[length:var(--ct-text-micro)] font-medium ${TAG_CLASS[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />
      {capability(item)}
    </span>
  );
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

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
        {domains.map((domain) => {
          const items = byDomain.get(domain) ?? [];
          return (
            <div
              key={domain}
              className="agentic-table-subhead flex flex-col overflow-hidden rounded-xl bg-surface-inset"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] px-4 py-3">
                <span className="ct-bento-label">
                  {DOMAIN_LABEL[domain] ?? domain}
                </span>
                <span className="text-[length:var(--ct-text-micro)] font-bold tabular-nums text-[var(--ct-text-faint)]">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col px-4">
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
