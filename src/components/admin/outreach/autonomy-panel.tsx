// Outreach autonomy panel — presentational Server Component.
//
// Surfaces the current OUTREACH_AUTONOMY posture (mode, what can auto-send,
// what is guarded) plus a run-readiness checklist, so an operator understands
// at a glance whether the agent is drafting only or sending under mandate, and
// why a send would or would not fire. Pure display: it renders the read-only
// status derived by getOutreachAutonomyStatus() — it changes no policy and
// sends nothing.

import { Badge } from "@/components/ui/badge";
import { BentoPanel } from "@/components/ui/bento";
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
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant={on ? "success" : "default"}
        className="h-3.5 min-w-10 justify-center px-1 py-0 text-[10px] uppercase tracking-wider"
      >
        {on ? "On" : "Off"}
      </Badge>
      <span className="text-[12px] font-medium text-zinc-500">{label}</span>
    </span>
  );
}

/** A single readiness rule row — guard label, state, and explanation. */
function ReadinessRow({ rule }: { rule: ReadinessRule }) {
  return (
    <li className="flex items-center gap-3 border-b border-white/5 py-1.5 last:border-0">
      <Badge
        variant={rule.ok ? "success" : "warning"}
        className="h-3.5 min-w-[42px] justify-center px-1 py-0 text-[10px] font-bold"
      >
        {rule.ok ? "OK" : "CHECK"}
      </Badge>
      <div className="flex min-w-0 flex-1 flex-col gap-0">
        <span className="text-[12px] font-medium text-white">{rule.label}</span>
        <span className="text-[12px] tabular-nums leading-relaxed text-zinc-500">{rule.detail}</span>
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
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Left: Status & Mode Summary */}
      <BentoPanel className="bg-[#15191C] p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                Autonomy
              </span>
              <Badge variant={MODE_VARIANT[status.mode]} className="font-bold">{status.mode}</Badge>
            </div>
            <span className="text-[10px] tabular-nums uppercase tracking-widest text-zinc-500">
              {status.forbiddenWordCount} guards active
            </span>
          </div>

          <p className="max-w-[48ch] text-[12px] leading-relaxed text-zinc-300">
            {status.modeDescription}
          </p>

          {status.liveSendWarning && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 py-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400">
                Live sending active (Resend OK)
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 pt-2">
            <CapabilityChip label="Auto-send" on={status.autoSendActive} />
            <CapabilityChip label="Follow-ups" on={status.followUpsActive} />
            <CapabilityChip label="Tier A Safe" on={status.tierAProtected} />
          </div>
        </div>
      </BentoPanel>

      {/* Right: Readiness Ledger */}
      <BentoPanel className="p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Readiness Ledger
            </span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">System Check</span>
          </div>
          <ul className="m-0 list-none p-0">
            {status.rules.map((rule) => (
              <ReadinessRow key={rule.label} rule={rule} />
            ))}
          </ul>
        </div>
      </BentoPanel>
    </div>
  );
}
