import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SimulateDemoPanel } from "@/components/admin/governance/simulate-demo-panel";

export default function SimulateDemoPage() {
  return (
    <div className="admin-doc-shell admin-doc-shell--narrow">
      <AdminPageHeader title="Simulation Panel — Demo" />
      <SimulateDemoPanel />
    </div>
  );
}
