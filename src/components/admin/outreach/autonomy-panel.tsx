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
      <Badge variant={on ? "success" : "default"}>{on ? "On" : "Off"}</Badge>
      <span className="body-xs ct-text-muted">{label}</span>
    </span>
  );
}

/** A single readiness rule row — guard label, state, and explanation. */
function ReadinessRow({ rule }: { rule: ReadinessRule }) {
  return (
    <li className="flex items-start gap-(--ct-space-2) py-(--ct-space-1_5) border-b border-(--ct-border-soft) last:border-0">
      <Badge variant={rule.ok ? "success" : "warning"}>
        {rule.ok ? "Ready" : "Check"}
      </Badge>
      <span className="min-w-0">
        <span className="body-sm ct-text-strong">{rule.label}</span>
        <span className="block body-xs ct-text-muted">{rule.detail}</span>
      </span>
    </li>
  );
}

export function OutreachAutonomyPanel({
  status,
}: {
  status: OutreachAutonomyStatus;
}) {
  return (
    <Card hoverOverlay={false}>
      <div className="flex flex-col gap-(--ct-space-4)">
        {/* Header — mode + one-line description */}
        <div className="flex flex-wrap items-center justify-between gap-(--ct-space-2)">
          <div className="flex items-center gap-(--ct-space-2)">
            <h3 className="h3">Outreach autonomy</h3>
            <Badge variant={MODE_VARIANT[status.mode]}>{status.mode}</Badge>
          </div>
          <span className="body-xs ct-text-muted">
            {status.forbiddenWordCount} prohibited claims guarded · Tier A always
            human-sent
          </span>
        </div>

        <p className="body-sm ct-text-body">{status.modeDescription}</p>

        {/* Live-send warning — only when mode is SEND+ AND Resend is configured */}
        {status.liveSendWarning ? (
          <div
            role="status"
            className="rounded-(--ct-radius-md) border border-(--ct-bc-warning) ct-status-warning-bg px-(--ct-space-3) py-(--ct-space-2)"
          >
            <span className="body-sm ct-status-warning">
              Live sending is possible at this mode — Resend is configured.
            </span>
            <span className="block body-xs ct-text-muted">
              Eligible Tier B/C prospects can receive automatic email within the
              daily budget. Tier A and suppressed addresses are still never
              auto-sent.
            </span>
          </div>
        ) : null}

        {/* Capability chips */}
        <div className="flex flex-wrap items-center gap-x-(--ct-space-4) gap-y-(--ct-space-2)">
          <CapabilityChip label="Auto first-touch" on={status.autoSendActive} />
          <CapabilityChip label="Follow-ups" on={status.followUpsActive} />
          <CapabilityChip label="Tier A protected" on={status.tierAProtected} />
          <CapabilityChip label="Resend configured" on={status.resendConfigured} />
        </div>

        {/* Run readiness checklist */}
        <div className="flex flex-col gap-(--ct-space-2)">
          <p className="stat-label">Run readiness</p>
          <ul className="m-0 list-none p-0">
            {status.rules.map((rule) => (
              <ReadinessRow key={rule.label} rule={rule} />
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
