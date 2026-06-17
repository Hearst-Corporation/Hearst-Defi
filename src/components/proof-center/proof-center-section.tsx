import type { ReactNode } from "react";

/**
 * Proof Center L2 section — visible page h2 + standard product-doc spacing.
 * Use `actions` for toolbar rows (e.g. proof grid filter).
 */
export function ProofCenterSection({
  id,
  title,
  actions,
  children,
}: {
  id: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="product-doc-section">
      {actions ? (
        <div className="product-doc-section__head">
          <h2 id={id} className="h2 m-0">
            {title}
          </h2>
          {actions}
        </div>
      ) : (
        <h2 id={id} className="h2 m-0">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
