import "server-only";

import { canRunDemoProvider } from "@/lib/demo/guard";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";

export interface AdminDemoMode {
  /** `DEMO_PROVIDER_ENABLED=1` in non-production — swaps loaders to demo builders. */
  providerEnabled: boolean;
  /** Show DemoDataBanner + demo props on proof surfaces. */
  showDemoBanner: boolean;
  /** PorSummary / ProofGrid honesty flag (provider OR seeded demo proofs in DB). */
  demo: boolean;
}

/**
 * Unified admin demo flags — replaces ad-hoc `canRunDemoProvider()` +
 * `databaseHasDemoProofs()` pairing on operator proof surfaces.
 */
export async function resolveAdminDemoMode(): Promise<AdminDemoMode> {
  const providerEnabled = canRunDemoProvider();
  const seededDemoProofs = providerEnabled ? false : await databaseHasDemoProofs();
  const showDemoBanner = providerEnabled || seededDemoProofs;

  return {
    providerEnabled,
    showDemoBanner,
    demo: showDemoBanner,
  };
}
