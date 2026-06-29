// Admin · Agentic Control Tower — Safety Boundary (presentational).
//
// READ-ONLY. Canon migration (Mission #064): the platform's hard limits inside
// the parent AdminSectionCard. One FLAT pillar block per limit (Console ·
// Forbidden · Human gates · Guards) — no border/radius/inset sub-surface, no
// cage-in-cage — separated by hairlines, each with a canon BentoBadge status
// chip (success = guaranteed, danger = the dangerous actions that are never
// autonomous, warning = gated) and the item list tucked into a nested <details>.
// No write controls. No hardcoded colour outside the canon (--ct-accent). Pure
// component.

import { BentoBadge } from "@/components/catalyst/bento-badge";
import type { BentoBadgeVariant } from "@/components/catalyst/bento-badge";
import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";

type Tone = "ok" | "warn" | "danger";

const TONE_VARIANT: Record<Tone, BentoBadgeVariant> = {
  ok: "success",
  warn: "warning",
  danger: "danger",
};

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-[var(--ct-accent)]",
  warn: "bg-[var(--ct-status-warning)]",
  danger: "bg-[var(--ct-status-danger)]",
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
    <div className="flex min-w-0 flex-col">
      <div className="grid grid-cols-1 gap-x-8 px-5 lg:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 border-b border-[var(--ct-border-soft)] py-4 last:border-b-0 lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="ct-bento-label flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[r.tone]}`}
                  aria-hidden
                />
                {r.pillar}
              </span>
              <BentoBadge variant={TONE_VARIANT[r.tone]} className="tabular-nums">
                {r.value}
              </BentoBadge>
            </div>

            {r.note ? (
              <p className="text-[length:var(--ct-text-2xs)] leading-relaxed text-[var(--ct-text-muted)]">
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
                      className="inline-flex items-center rounded-md border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-bg-deep)_40%,transparent)] px-2 py-0.5 text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]"
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
    </div>
  );
}
