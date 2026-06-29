// Admin · Agentic Control Center — Tool Boundary v1 (presentational).
//
// READ-ONLY. Renders the reflection of the REAL tool registry: per-tier counts,
// a tool table (tier / risk / gate / source), consistency warnings comparing the
// static display against the code, and safety notes. NO write controls, NO action
// buttons, NO run/send/deploy/source — nothing executes. Pure component; all data
// passed in, unit-testable via SSR.
//
// Bento canon (Portfolio): black BentoPanel + hairline border, micro uppercase
// labels, single accent green (--ct-accent). Tiers/risk/severity render as colored
// chips — read=zinc, gated-write=amber, danger=red, allowed/ok=accent green.

import type { ReactNode } from "react";

import {
  BentoHeader,
  BentoKpiTile,
  BentoPanel,
} from "@/components/catalyst/bento";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import type { BentoBadgeVariant } from "@/components/catalyst/bento-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import { cn } from "@/lib/cn";
import type {
  ReflectedToolBoundaryItem,
  ToolBoundaryConsistencyIssue,
  ToolBoundaryRiskLevel,
  ToolBoundaryTier,
  ToolBoundaryV1Summary,
} from "@/lib/agentic/tool-boundary";

/** Bento chip tone → canon BentoBadge variant. */
type ChipTone = "ok" | "warn" | "danger" | "neutral";

/** Single green (--ct-accent) for ok/allowed; amber for gated, red for danger, default otherwise. */
const CHIP_VARIANT: Record<ChipTone, BentoBadgeVariant> = {
  ok: "success",
  warn: "warning",
  danger: "danger",
  neutral: "default",
};

function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <BentoBadge variant={CHIP_VARIANT[tone]}>{children}</BentoBadge>;
}

const TIER_LABEL: Record<ToolBoundaryTier, string> = {
  read_only: "Read-only",
  draft_or_proposal: "Draft / proposal",
  confirmed_write: "Confirmed-write",
  forbidden_autonomous: "Forbidden-autonomous",
  unknown: "Unknown",
};

function tierTone(tier: ToolBoundaryTier): ChipTone {
  switch (tier) {
    case "read_only":
      return "ok";
    case "draft_or_proposal":
    case "confirmed_write":
      return "warn";
    case "forbidden_autonomous":
      return "danger";
    default:
      return "danger"; // unknown is treated as high-risk
  }
}

function riskTone(risk: ToolBoundaryRiskLevel): ChipTone {
  switch (risk) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "warn";
    default:
      return "neutral";
  }
}

function severityTone(
  severity: ToolBoundaryConsistencyIssue["severity"],
): ChipTone {
  switch (severity) {
    case "critical":
      return "danger";
    case "warning":
      return "warn";
    default:
      return "neutral";
  }
}

const COUNT_TIERS: ToolBoundaryTier[] = [
  "read_only",
  "draft_or_proposal",
  "confirmed_write",
  "forbidden_autonomous",
  "unknown",
];

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TableHeader className={cn("ct-bento-label bg-transparent", className)}>
      {children}
    </TableHeader>
  );
}

function ToolRow({ tool }: { tool: ReflectedToolBoundaryItem }) {
  return (
    <TableRow className="align-top transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]">
      <TableCell className="break-all font-mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-body)]">
        {tool.id}
      </TableCell>
      <TableCell>
        <Chip tone={tierTone(tool.tier)}>{TIER_LABEL[tool.tier]}</Chip>
      </TableCell>
      <TableCell>
        <Chip tone={riskTone(tool.riskLevel)}>{tool.riskLevel}</Chip>
      </TableCell>
      <TableCell className="whitespace-nowrap text-[length:var(--ct-text-2xs)] tabular-nums text-[var(--ct-text-faint)]">
        {tool.humanGateRequired ? "HITL" : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-[length:var(--ct-text-2xs)] tabular-nums text-[var(--ct-text-faint)]">
        {tool.autonomousAllowed ? "yes" : "no"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
        {tool.runtimeStatus}
      </TableCell>
      <TableCell className="break-all font-mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
        {tool.source}
      </TableCell>
    </TableRow>
  );
}

export function ToolBoundarySection({
  summary,
}: {
  summary: ToolBoundaryV1Summary | null | undefined;
}) {
  if (!summary) return null;

  const { counts, tools, consistencyIssues, safetyNotes } = summary;
  const criticalCount = consistencyIssues.filter(
    (i) => i.severity === "critical",
  ).length;
  const realTools = tools.filter((t) => t.tier !== "forbidden_autonomous");
  const forbiddenActions = tools.filter(
    (t) => t.tier === "forbidden_autonomous",
  );

  return (
    <section
      id="tool-boundary-v1"
      className="flex flex-col gap-y-5"
      aria-label="Tool Boundary v1"
    >
      <BentoPanel>
        <BentoHeader
          title="Tool Boundary v1 — registry reflection"
          subtitle="The real tools declared in the registry, reflected read-only — tier, gate, risk, runtime status, and source. Nothing here executes a tool."
          as="h3"
          trailing={
            <>
              <Chip tone="ok">source: code reflection</Chip>
              <Chip tone={criticalCount > 0 ? "danger" : "ok"}>
                {criticalCount > 0 ? `${criticalCount} critical` : "consistent"}
              </Chip>
            </>
          }
        />

        {/* Per-tier counts */}
        <div className="grid grid-cols-2 gap-px bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] sm:grid-cols-3 lg:grid-cols-5">
          {COUNT_TIERS.map((tier) => (
            <BentoKpiTile
              key={tier}
              className="bg-surface-card"
              label={TIER_LABEL[tier]}
              value={counts[tier]}
              accent={tier === "read_only"}
            />
          ))}
        </div>
      </BentoPanel>

      {/* Consistency warnings (read-only) */}
      <BentoPanel>
        <BentoHeader
          title="Static-vs-code consistency"
          as="h3"
          trailing={
            <Chip tone={consistencyIssues.length === 0 ? "ok" : "warn"}>
              {consistencyIssues.length === 0
                ? "no drift"
                : `${consistencyIssues.length} issue${consistencyIssues.length > 1 ? "s" : ""}`}
            </Chip>
          }
        />
        <div className="p-5">
          {consistencyIssues.length === 0 ? (
            <p className="m-0 text-[length:var(--ct-text-xs)] leading-snug text-[var(--ct-text-muted)]">
              The static Control Center boundary matches the real registry — no
              missing, stale, or misclassified tools.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {consistencyIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex items-start gap-2.5"
                >
                  <Chip tone={severityTone(issue.severity)}>
                    {issue.severity}
                  </Chip>
                  <span className="flex-1 text-[length:var(--ct-text-xs)] leading-snug text-[var(--ct-text-muted)]">
                    {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </BentoPanel>

      {/* Real tools table */}
      <BentoPanel>
        <BentoHeader
          title="Tools"
          subtitle="Tier · risk · gate · autonomous · runtime · source"
          as="h3"
        />
        <Table dense className="text-[length:var(--ct-text-xs)]">
          <TableHead>
            <TableRow>
              {["Tool", "Tier", "Risk", "Gate", "Autonomous", "Runtime", "Source"].map(
                (h) => (
                  <Th key={h} className="whitespace-nowrap">
                    {h}
                  </Th>
                ),
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {realTools.map((t) => (
              <ToolRow key={t.id} tool={t} />
            ))}
          </TableBody>
        </Table>
      </BentoPanel>

      {/* Forbidden-autonomous actions (represented, not callable tools) */}
      <BentoPanel>
        <BentoHeader
          title="Forbidden-autonomous actions (not callable tools)"
          as="h3"
          trailing={<Chip tone="danger">{forbiddenActions.length}</Chip>}
        />
        <ul className="flex flex-col p-5">
          {forbiddenActions.map((a) => (
            <li
              key={a.id}
              className="border-b border-[var(--ct-border-soft)] py-3 text-[length:var(--ct-text-xs)] leading-snug last:border-b-0"
            >
              <span className="font-medium text-[var(--ct-text-strong)]">{a.name}</span>
              <span className="text-[var(--ct-text-faint)]"> — {a.notes}</span>
            </li>
          ))}
        </ul>
      </BentoPanel>

      {/* Safety notes */}
      <BentoPanel>
        <BentoHeader title="Safety" as="h3" />
        <ul className="flex flex-col gap-2 p-5">
          {safetyNotes.map((note) => (
            <li
              key={note}
              className="flex gap-2 text-[length:var(--ct-text-2xs)] leading-snug text-[var(--ct-text-faint)]"
            >
              <span aria-hidden className="select-none text-[var(--ct-text-faint)]">
                ·
              </span>
              <span className="flex-1">{note}</span>
            </li>
          ))}
        </ul>
      </BentoPanel>
    </section>
  );
}
