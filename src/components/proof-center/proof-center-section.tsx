import type { ReactNode } from "react";

/**
 * Proof Center L2 section — visible page h2 + standard product-doc spacing.
 * Use `actions` for toolbar rows (e.g. proof grid filter).
 */
export function ProofCenterSection({
  id,
  title,
  actions,
  variant = "product",
  children,
}: {
  id: string;
  title: string;
  actions?: ReactNode;
  variant?: "product" | "admin";
  children: ReactNode;
}) {
  const sectionClass = variant === "admin" ? "admin-doc-stack admin-doc-stack--compact" : "product-doc-section";
  const titleClass = "h2 m-0";

  return (
    <section aria-labelledby={id} className={sectionClass}>
      {actions ? (
        <div className={variant === "admin" ? "flex items-center justify-between" : "product-doc-section__head"}>
          <h2 id={id} className={titleClass}>
            {title}
          </h2>
          {actions}
        </div>
      ) : (
        <h2 id={id} className={titleClass}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
