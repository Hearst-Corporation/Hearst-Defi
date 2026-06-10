import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Uniform product page title — mirror of AdminPageHeader for investor surfaces.
 */
export function ProductPageHeader({
  eyebrow,
  title,
  description,
  lead,
  media,
  actions,
  children,
  className,
  align = "start",
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Block above eyebrow (back link, centered icon in align=center flows). */
  lead?: ReactNode;
  /** Optional media slot to the left of the title stack (avatar, icon). */
  media?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  const centered = align === "center";

  return (
    <header
      className={cn(
        "flex flex-col gap-5",
        centered && "items-center text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full flex-wrap gap-4",
          centered ? "flex-col items-center" : "items-start justify-between",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-4",
            centered && "flex-col items-center",
          )}
        >
          {media ? <div className="shrink-0">{media}</div> : null}
          <div
            className={cn(
              "flex min-w-0 flex-col gap-1",
              centered && "items-center",
            )}
          >
            {lead}
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h1 className="h1 shrink-0">{title}</h1>
            {description ? (
              <div
                className={cn(
                  "body-sm mt-1 max-w-2xl ct-text-muted",
                  centered && "mx-auto",
                )}
              >
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
