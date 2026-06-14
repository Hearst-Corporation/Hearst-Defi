import { cn } from "@/lib/cn";

const DEMO_BANNER_COPY =
  "Demo data · Local visual QA — not production" as const;

interface DemoDataBannerProps {
  className?: string;
  /**
   * Optional override copy. When provided, it replaces the default banner text
   * (used by the Demo Provider to surface DEMO_SANDBOX_DISCLAIMER). Existing
   * callers omit it and keep the default copy unchanged.
   */
  message?: string;
}

export function DemoDataBanner({ className, message }: DemoDataBannerProps) {
  return (
    <div
      role="note"
      aria-label="Demo data notice"
      className={cn(
        "rounded-md border border-[var(--ct-status-warning-border)] ct-status-warning-bg px-4 py-2.5",
        className,
      )}
    >
      <p className="body-sm m-0 ct-status-warning font-medium">
        {message ?? DEMO_BANNER_COPY}
      </p>
    </div>
  );
}
