// Admin · Agentic Control Tower — Capabilities (presentational).
//
// READ-ONLY. "What can the platform do, and how safely?" — one row per autonomy
// tier (count · tier · meaning). The per-action detail lives once in Actions &
// Gates below. No hardcoded values. Pure component.
//
// Bento canon (Portfolio): black BentoPanel + hairline border, micro uppercase
// labels, single accent green (--ct-accent). Tier renders as a colored chip —
// autonomous/read-only=accent green, draft/gated=amber, never-autonomous=red.

import type { ReactNode } from "react";

import { BentoHeader, BentoPanel } from "@/components/ui/bento";
import { cn } from "@/lib/cn";
import type {
  ActionReadinessMatrix,
  ActionReadinessTier,
} from "@/lib/agentic/action-readiness/types";

/** Bento chip tone — drives the border/bg/text triplet only. */
type ChipTone = "ok" | "warn" | "danger";

/** Single green (--ct-accent) for autonomous; amber for gated, red for never-autonomous. */
const CHIP_TONE: Record<ChipTone, string> = {
  ok: "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]",
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  danger: "border-red-400/30 bg-red-400/10 text-red-400",
};

function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
        CHIP_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

interface Capability {
  tier: ActionReadinessTier;
  title: string;
  meaning: string;
  tone: ChipTone;
}

const CAPABILITIES: Capability[] = [
  {
    tier: "read_only",
    title: "Autonomous",
    meaning: "Reads only — safe to run without human review.",
    tone: "ok",
  },
  {
    tier: "draft_or_proposal",
    title: "Draft only",
    meaning: "Agent prepares; human must confirm before anything sends.",
    tone: "warn",
  },
  {
    tier: "confirmed_write",
    title: "Gated write",
    meaning: "Explicit 2-step human confirmation required.",
    tone: "warn",
  },
  {
    tier: "forbidden_autonomous",
    title: "Never autonomous",
    meaning: "Deploy, mark-live, signatures, migrations — always blocked.",
    tone: "danger",
  },
];

export function AgenticCapabilitiesBoard({
  matrix,
}: {
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!matrix) return null;

  return (
    <BentoPanel id="capabilities" aria-label="Capabilities">
      <BentoHeader
        title="Capabilities"
        subtitle="What the platform can do, by how much human oversight it needs."
        as="h3"
        trailing={
          <span className="text-[18px] font-medium leading-none text-white tabular-nums">
            {CAPABILITIES.length}
          </span>
        }
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5">
              <th className="ct-bento-label bg-transparent px-4 py-3 text-right whitespace-nowrap">
                Count
              </th>
              <th className="ct-bento-label bg-transparent px-4 py-3">
                Tier
              </th>
              <th className="ct-bento-label bg-transparent px-4 py-3">
                Meaning
              </th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((c) => {
              const count = matrix.items.filter(
                (i) => i.tier === c.tier,
              ).length;
              return (
                <tr
                  key={c.tier}
                  className="border-b border-white/5 align-middle transition-colors last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-right font-medium text-white tabular-nums">
                    {count}
                  </td>
                  <td className="px-4 py-3">
                    <Chip tone={c.tone}>{c.title}</Chip>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{c.meaning}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BentoPanel>
  );
}
