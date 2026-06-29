import type { ReactNode } from "react";

export function VaultDetailRow({
  label,
  value,
  action,
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="ct-bento-label">
          {label}
        </span>
        <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums">
          {value}
        </span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
