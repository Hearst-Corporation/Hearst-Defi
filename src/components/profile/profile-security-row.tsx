import { cn } from "@/lib/cn";

export type ProfileSecurityStatus = "ok" | "warn" | "off";

export function ProfileSecurityRow({
  status,
  title,
  description,
  action,
}: {
  status: ProfileSecurityStatus;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div
      role="listitem"
      className="flex items-start justify-between gap-3 py-3"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-[var(--ct-space-1_5)] size-2 shrink-0 rounded-full",
            status === "ok" && "bg-[var(--ct-accent)]",
            status === "warn" && "bg-[var(--ct-status-warning)]",
            status === "off" && "bg-[var(--ct-text-faint)]",
          )}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="body-sm font-medium ct-text-body">{title}</span>
          <span className="body-xs ct-text-faint">{description}</span>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
