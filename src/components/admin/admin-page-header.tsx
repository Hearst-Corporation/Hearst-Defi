import {
  PageHeaderBase,
  type PageHeaderBaseProps,
} from "@/components/connect/page-header-base";

/**
 * Uniform admin page title — mirror of ProductPageHeader.
 * Thin wrapper over {@link PageHeaderBase} pinning the `admin-page-header`
 * BEM namespace. API canon: `titleLead` + `titleAccent` + `contextLabel`.
 * API legacy: `title` (+ `accent`, `eyebrow`, `description`).
 */
export function AdminPageHeader(props: PageHeaderBaseProps) {
  return <PageHeaderBase rootClass="admin-page-header" {...props} />;
}
