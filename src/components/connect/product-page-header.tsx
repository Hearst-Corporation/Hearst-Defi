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
        "product-page-header",
        centered && "product-page-header--center",
        className,
      )}
    >
      <div
        className={cn(
          "product-page-header__row",
          centered && "product-page-header__row--center",
        )}
      >
        <div
          className={cn(
            "product-page-header__main",
            centered && "product-page-header__main--center",
          )}
        >
          {media ? <div className="shrink-0">{media}</div> : null}
          <div
            className={cn(
              "product-page-header__title-stack",
              centered && "product-page-header__title-stack--center",
            )}
          >
            {lead}
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1 className="h1 shrink-0">{title}</h1>
            {description ? (
              <div
                className={cn(
                  "body-md mt-1 ct-prose-md ct-text-muted",
                  centered && "mx-auto",
                )}
              >
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="product-page-header__actions">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
