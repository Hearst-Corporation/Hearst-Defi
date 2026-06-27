import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Proof Center L2 section — visible page h2 + standard product-doc spacing.
 * Use `actions` for toolbar rows (e.g. proof grid filter).
 *
 * NOTE: this is a section WRAPPER consumed by other proof-center components.
 * Its props signature (id / title / actions / variant / children) is part of
 * that contract and MUST NOT change — only the internal visual rendering does.
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
  const sectionClass =
    variant === "admin"
      ? "admin-doc-stack admin-doc-stack--compact"
      : "product-doc-section";

  // Bento section heading — micro uppercase label, accent underscore, optional
  // toolbar row on the right. Stays a real <h2> carrying the id so the section's
  // aria-labelledby contract holds.
  const heading = (
    <h2
      id={id}
      className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none m-0"
    >
      {title}
    </h2>
  );

  return (
    <section aria-labelledby={id} className={sectionClass}>
      {actions ? (
        <div
          className={cn(
            "flex items-center justify-between gap-4",
            variant === "product" && "product-doc-section__head",
          )}
        >
          {heading}
          {actions}
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  );
}
