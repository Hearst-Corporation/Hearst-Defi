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
      className="product-doc-inline-row product-doc-inline-row--start product-doc-inline-row--loose py-2.5"
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          status === "ok" && "ct-status-dot-success",
          status === "warn" && "ct-status-dot-warning",
          status === "off" && "bg-(--ct-text-faint)",
        )}
      />
      <div className="pf-inline-row pf-inline-row--between min-w-0 flex-1 gap-[var(--ct-space-3)]">
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="body-sm font-medium ct-text-primary">{title}</span>
          <span className="body-xs ct-text-muted">{description}</span>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
