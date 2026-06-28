/**
 * COMPAT FAÇADE — single-DS convergence.
 *
 * The real implementation now lives in
 * `@/components/catalyst/chart-disclaimer-underlay`. This thin file re-exports
 * it so existing `@/components/ui/chart-disclaimer-underlay` importers keep
 * working unchanged. Edit the Catalyst source, not this façade.
 */
export {
  ChartDisclaimerUnderlay,
} from "@/components/catalyst/chart-disclaimer-underlay";
export type { ChartDisclaimerUnderlayProps } from "@/components/catalyst/chart-disclaimer-underlay";
