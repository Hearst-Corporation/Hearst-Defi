// Outreach autonomy panel — presentational Server Component.
//
// Surfaces the current OUTREACH_AUTONOMY posture (mode, what can auto-send,
// what is guarded) plus a run-readiness checklist, so an operator understands
// at a glance whether the agent is drafting only or sending under mandate, and
// why a send would or would not fire. Pure display: it renders the read-only
// status derived by getOutreachAutonomyStatus() — it changes no policy and
// sends nothing.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  OutreachAutonomyStatus,
  ReadinessRule,
} from "@/lib/outreach/autonomy-status";

/** Autonomy mode → Badge variant (accent = active autopilot, default = drafts only). */
const MODE_VARIANT: Record<
  OutreachAutonomyStatus["mode"],
  "default" | "accent" | "warning"
> = {
  SUGGEST: "default",
  SEND: "accent",
  NURTURE: "accent",
  CLOSED: "warning",
};

/** A capability chip: ON/OFF state for a posture flag. */
function CapabilityChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span className="inline-flex items-center gap-(--ct-space-1_5)">
      <Badge 
        variant={on ? "success" : "default"} 
        className="px-[var(--ct-space-1)] py-0 h-3.5 text-[length:var(--ct-text-nano)] uppercase tracking-wider min-w-[var(--ct-space-10)] justify-center"
      >
        {on ? "On" : "Off"}
      </Badge>
      <span className="body-xs ct-text-faint font-medium">{label}</span>
    </span>
  );
}

/** A single readiness rule row — guard label, state, and explanation. */
function ReadinessRow({ rule }: { rule: ReadinessRule }) {
  return (
    <li className="flex items-center gap-(--ct-space-3) py-(--ct-space-1_5) border-b border-(--ct-border-soft) last:border-0">
      <Badge 
        variant={rule.ok ? "success" : "warning"} 
        className="px-[var(--ct-space-1)] py-0 h-3.5 min-w-[42px] justify-center text-[length:var(--ct-text-nano)] font-bold"
      >
        {rule.ok ? "OK" : "CHECK"}
      </Badge>
      <div className="min-w-0 flex-1 flex flex-col gap-0">
        <span className="body-xs ct-text-strong font-medium">{rule.label}</span>
        <span className="body-xs ct-text-faint tabular-nums leading-relaxed">{rule.detail}</span>
      </div>
    </li>
  );
}

export function OutreachAutonomyPanel({
  status,
}: {
  status: OutreachAutonomyStatus;
}) {
  return (
    <div className="outreach-autonomy-grid">
      {/* Left: Status & Mode Summary */}
      <Card className="admin-card--tight bg-(--ct-graphite-subtle-bg)" hoverOverlay={false}>
        <div className="flex flex-col gap-(--ct-space-3)">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-(--ct-space-2)">
              <span className="stat-label ct-text-faint">Autonomy</span>
              <Badge variant={MODE_VARIANT[status.mode]} className="font-bold">{status.mode}</Badge>
            </div>
            <span className="body-2xs ct-text-faint tabular-nums uppercase tracking-widest">
              {status.forbiddenWordCount} guards active
            </span>
          </div>

          <p className="body-xs ct-text-body leading-relaxed max-w-[48ch]">
            {status.modeDescription}
          </p>

          {status.liveSendWarning && (
            <div className="rounded-(--ct-radius-sm) border border-(--ct-bc-warning)/20 bg-(--ct-bc-warning)/5 px-(--ct-space-2) py-(--ct-space-1)">
              <p className="body-2xs ct-status-warning font-bold uppercase tracking-wide">
                Live sending active (Resend OK)
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-(--ct-space-4) gap-y-(--ct-space-2) pt-(--ct-space-2) border-t border-(--ct-border-soft)">
            <CapabilityChip label="Auto-send" on={status.autoSendActive} />
            <CapabilityChip label="Follow-ups" on={status.followUpsActive} />
            <CapabilityChip label="Tier A Safe" on={status.tierAProtected} />
          </div>
        </div>
      </Card>

      {/* Right: Readiness Ledger */}
      <Card className="admin-card--tight" hoverOverlay={false}>
        <div className="flex flex-col gap-(--ct-space-2)">
          <div className="flex items-center justify-between">
            <span className="stat-label ct-text-faint">Readiness Ledger</span>
            <span className="body-2xs ct-text-faint uppercase tracking-widest">System Check</span>
          </div>
          <ul className="m-0 list-none p-0">
            {status.rules.map((rule) => (
              <ReadinessRow key={rule.label} rule={rule} />
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
