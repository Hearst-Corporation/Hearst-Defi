// Admin · Agentic Control Tower — Agents & Crews (presentational).
//
// READ-ONLY. Rewritten 2026-06-26: the agent / logic inventory as ONE table
// inside a collapsible group, grouped by domain via sub-header rows. One dense
// row per agent (name · domain · capability), not 22 cards. No hardcoded values.
// Pure component.

import { Fragment } from "react";
import { AgenticGroup, AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
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

function capability(item: AgenticInventoryItem): string {
  if (!item.writesAllowed) return "reads only";
  if (item.humanGateRequired) return "writes — gated";
  return "writes";
}

function capabilityTone(item: AgenticInventoryItem): AgenticTone {
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
    <AgenticGroup
      id="agents-overview"
      title="Agents & Crews"
      count={inventory.length}
      note={`${inventory.length} units · ${domains.length} domains · ${inventory.length - writeCount} read-only · ${gatedCount} gated write${gatedCount !== 1 ? "s" : ""}.`}
    >
      <table className="agentic-table">
        <thead>
          <tr>
            <th>Agent / surface</th>
            <th>Capability</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => {
            const items = byDomain.get(domain) ?? [];
            return (
              <Fragment key={domain}>
                <tr className="agentic-table-subhead">
                  <td colSpan={2}>
                    {DOMAIN_LABEL[domain] ?? domain}
                    <span className="agentic-table-subhead-count">{items.length}</span>
                  </td>
                </tr>
                {items.map((item) => (
                  <tr key={item.id} data-tone={capabilityTone(item)}>
                    <td className="agentic-cell-strong">{item.name}</td>
                    <td>
                      <AgenticTag tone={capabilityTone(item)}>
                        {capability(item)}
                      </AgenticTag>
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </AgenticGroup>
  );
}
