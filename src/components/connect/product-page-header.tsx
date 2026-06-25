import { PageHeaderBase, type PageHeaderBaseProps } from "./page-header-base";

/**
 * Uniform product page title — PORTFOLIO canon skeleton (mirror of AdminPageHeader):
 *   H1 bicolore (`titleLead` + `titleAccent`) → kicker « — CONTEXTE » → trait
 *   accent (toujours rendu) → contenu (notices/erreurs APRÈS le trait).
 *
 * Thin wrapper over {@link PageHeaderBase} pinning the `product-page-header`
 * BEM namespace. API canon: `titleLead` + `titleAccent` + `contextLabel`.
 * API legacy: `title` (+ `accent`, `eyebrow`, `description`).
 */
export function ProductPageHeader(props: PageHeaderBaseProps) {
  return <PageHeaderBase rootClass="product-page-header" {...props} />;
}
