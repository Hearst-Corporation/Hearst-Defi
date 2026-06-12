import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SimulateDemoPanel } from "@/components/admin/governance/simulate-demo-panel";

export default function SimulateDemoPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <AdminPageHeader title="Simulation Panel — Demo" />
      <SimulateDemoPanel />
    </div>
  );
}
