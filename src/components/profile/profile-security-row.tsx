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
    <li className="prof-security-row">
      <span
        aria-hidden
        className={cn(
          "prof-security-dot",
          status === "ok" && "ct-status-dot-success",
          status === "warn" && "ct-status-dot-warning",
          status === "off" && "prof-security-dot--off",
        )}
      />
      <div className="prof-security-body">
        <span className="body-sm ct-text-primary prof-security-title">{title}</span>
        <span className="body-xs ct-text-muted">{description}</span>
      </div>
      <div className="prof-security-action">{action}</div>
    </li>
  );
}
