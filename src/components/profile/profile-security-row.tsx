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
      className="product-doc-inline-row product-doc-inline-row--start product-doc-inline-row--loose prof-security-row"
    >
      <span
        aria-hidden
        className={cn(
          "prof-security-row__dot",
          status === "ok" && "ct-status-dot-success",
          status === "warn" && "ct-status-dot-warning",
          status === "off" && "prof-security-row__dot--off",
        )}
      />
      <div className="pf-inline-row pf-inline-row--between prof-security-row__body">
        <div className="prof-security-row__copy">
          <span className="body-sm font-medium ct-text-primary">{title}</span>
          <span className="body-xs ct-text-muted">{description}</span>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
