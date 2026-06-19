// Dev-only governance simulation — intentionally unwired from left rail.
// Entry point: /admin/governance « Dev tools » when DEMO_PROVIDER_ENABLED=1.

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SimulateDemoPanel } from "@/components/admin/governance/simulate-demo-panel";

export default function SimulateDemoPage() {
  return (
    <div className="admin-doc-shell admin-doc-shell--narrow">
      <AdminPageHeader
        title="Simulation Panel — Demo"
        description="Mock proposal calldata runs via Tenderly stub. Linked from Governance → Dev tools; not in main nav."
      />
      <SimulateDemoPanel />
    </div>
  );
}
