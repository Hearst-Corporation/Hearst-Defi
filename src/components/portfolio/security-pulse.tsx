import { Shield, Lock, Eye, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

/**
 * SecurityPulse — Trust-building component summarizing active security measures.
 * Institutional signal reinforcing that the platform is secure and audited.
 */

interface SecurityItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  tooltip: string;
}

function SecurityItem({ icon: Icon, label, value, tooltip }: SecurityItemProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--ct-accent)/10 text-(--ct-accent)">
        <Icon size={16} />
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center justify-between gap-2">
          <Tooltip content={tooltip}>
            <span className="body-xs ct-text-muted cursor-help border-b border-dotted border-(--ct-border-soft)">
              {label}
            </span>
          </Tooltip>
          <span className="body-xs font-medium ct-text-strong truncate">{value}</span>
        </div>
      </div>
    </div>
  );
}

export function SecurityPulse() {
  return (
    <article className="dash-cell dash-cell-premium h-full flex flex-col">
      <div className="dash-label relative z-10">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-(--ct-accent)" />
          <span className="font-semibold ct-text-strong">Security Pulse</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-(--ct-status-success)/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-(--ct-status-success) border border-(--ct-status-success)/20">
          <span className="h-1 w-1 rounded-full bg-(--ct-status-success) animate-pulse" />
          Active
        </div>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-(--ct-border-soft) relative z-10">
        <SecurityItem
          icon={Lock}
          label="Encryption"
          value="AES-256 / TLS 1.3"
          tooltip="All data is encrypted at rest using AES-256 and in transit via TLS 1.3."
        />
        <SecurityItem
          icon={Eye}
          label="Session Security"
          tooltip="Sessions are protected by HttpOnly, Secure, and SameSite=Strict cookies."
          value="Hardened"
        />
        <SecurityItem
          icon={CheckCircle2}
          label="Audit Status"
          value="Spearbit"
          tooltip="Smart contracts and infrastructure are audited by Spearbit."
        />
      </div>

      <div className="mt-auto pt-6 relative z-10">
        <p className="body-xs ct-text-faint italic">
          Institutional-grade security protocols active. All transactions require multi-signature authorization.
        </p>
      </div>
    </article>
  );
}
