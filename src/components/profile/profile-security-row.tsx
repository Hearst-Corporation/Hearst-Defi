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
      className="flex items-start justify-between gap-3 py-3 border-b border-[var(--ct-border-soft)]"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            status === "ok" && "bg-[var(--ct-accent)]",
            status === "warn" && "bg-amber-400",
            status === "off" && "bg-zinc-600",
          )}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-body)]">{title}</span>
          <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">{description}</span>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
