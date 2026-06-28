// Admin · Agentic Control Tower — Safety Boundary (presentational).
//
// READ-ONLY. Bento conversion 2026-06-28: the platform's hard limits as a black
// BentoPanel, one #15191C sub-surface per pillar (Console · Forbidden · Human
// gates · Guards) with a coloured status dot (green = guaranteed, red = the
// dangerous actions that are never autonomous, amber = gated) and the item list
// tucked into a nested <details>. No write controls. No hardcoded colour outside
// the canon (--ct-accent). Pure component.

import { BentoHeader, BentoPanel } from "@/components/ui/bento";
import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";

type Tone = "ok" | "warn" | "danger";

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-[var(--ct-accent)]",
  warn: "bg-amber-400/80",
  danger: "bg-red-400/80",
};

const TAG_CLASS: Record<Tone, string> = {
  ok: "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]",
  warn: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  danger: "border-red-400/25 bg-red-400/10 text-red-300",
};

export function AgenticSafetyBoundary({
  controlCenter,
  matrix,
}: {
  controlCenter: AgenticControlCenterData | null | undefined;
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!controlCenter) return null;

  const guards = controlCenter.inventory.filter((i) => i.type === "guard");
  const gates = controlCenter.gates;
  const forbidden =
    matrix?.items.filter((i) => i.tier === "forbidden_autonomous") ?? [];
  const safetyHolds = controlCenter.safetySummary.filter((s) => s.holds).length;
  const safetyTotal = controlCenter.safetySummary.length;

  interface PillarRow {
    id: string;
    pillar: string;
    value: string;
    tone: Tone;
    detail?: { summary: string; items: string[] };
    note?: string;
  }

  const rows: PillarRow[] = [
    {
      id: "console",
      pillar: "Console",
      value: "Read-only",
      tone: "ok",
      note: "Nothing executes here. No run, send, deploy, or mark-live control exists on this page.",
    },
    {
      id: "forbidden",
      pillar: "Forbidden",
      value: `${forbidden.length} never autonomous`,
      tone: "danger",
      detail: { summary: "list", items: forbidden.map((f) => f.label) },
    },
    {
      id: "gates",
      pillar: "Human gates",
      value: `${gates.length} gated actions`,
      tone: "warn",
      note: "Admin role + two-step confirmation token required.",
    },
    {
      id: "guards",
      pillar: "Guards",
      value: `${guards.length} always-on`,
      tone: "ok",
      detail: { summary: "list", items: guards.map((g) => g.name) },
      note: `${safetyHolds}/${safetyTotal} guarantees verified.`,
    },
  ];

  return (
    <BentoPanel>
      <BentoHeader
        title="Safety Boundary"
        subtitle="The hard limits. Nothing executes here. Every write is gated; the most dangerous actions can never be autonomous."
      />

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-xl border border-[var(--ct-border-soft)] bg-surface-inset p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="ct-bento-label flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[r.tone]}`}
                  aria-hidden
                />
                {r.pillar}
              </span>
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${TAG_CLASS[r.tone]}`}
              >
                {r.value}
              </span>
            </div>

            {r.note ? (
              <p className="text-[12px] leading-relaxed text-[var(--ct-text-muted)]">
                {r.note}
              </p>
            ) : null}

            {r.detail && r.detail.items.length > 0 ? (
              <details className="group">
                <summary className="ct-bento-label flex cursor-pointer list-none items-center gap-2 transition-colors hover:text-[var(--ct-text-body)]">
                  <span
                    className="inline-block h-1.5 w-1.5 rotate-45 border-b border-r border-current transition-transform group-open:rotate-[225deg]"
                    aria-hidden
                  />
                  {r.detail.summary} ({r.detail.items.length})
                </summary>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.detail.items.map((it) => (
                    <span
                      key={it}
                      className="inline-flex items-center rounded-md border border-[var(--ct-border)] bg-black/40 px-2 py-0.5 text-[11px] text-[var(--ct-text-muted)]"
                    >
                      {it}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </BentoPanel>
  );
}
