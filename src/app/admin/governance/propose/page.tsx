import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { proposeAction } from "@/lib/governance/actions";
import { adminFormField } from "@/lib/ui/form-classes";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const ACTION_TYPES = [
  "deploy",
  "pause",
  "unpause",
  "updateFees",
  "updateCaps",
  "rotateSigners",
  "sweepFees",
  "emergencyShutdown",
] as const;

async function handlePropose(formData: FormData) {
  "use server";
  await requireAdmin();

  const vaultId = formData.get("vaultId") as string;
  const actionType = formData.get("actionType") as string;
  const calldata = (formData.get("calldata") as string) || undefined;
  const justification = formData.get("justification") as string;

  const result = await proposeAction(
    vaultId,
    actionType as Parameters<typeof proposeAction>[1],
    calldata,
    justification,
  );

  redirect(`/admin/governance/proposal/${result.id}`);
}

export default async function ProposePage() {
  await requireAdmin();

  const vaults = await prisma.vaultDeployment.findMany({
    where: { status: { not: "closed" } },
    orderBy: { ticker: "asc" },
    select: { id: true, ticker: true, name: true },
  });

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="New proposal"
        lead={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/governance">← Governance</Link>
          </Button>
        }
      />

      <Card>
        <DashboardPanelHeader title="Proposal details" tone="quiet" className="mb-6" />
        <form action={handlePropose} className="admin-doc-stack">
          <div className="admin-doc-stack--dense">
            <label htmlFor="vaultId" className="stat-label block">
              Vault *
            </label>
            {vaults.length === 0 ? (
              <p className="body-sm ct-text-muted">
                No vaults available.{" "}
                <Link href="/admin/vaults/new" className="ct-text-primary underline underline-offset-2">
                  Create a vault first.
                </Link>
              </p>
            ) : (
              <select id="vaultId" name="vaultId" required className={adminFormField}>
                <option value="">Select a vault…</option>
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.ticker} — {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="admin-doc-stack--dense">
            <label htmlFor="actionType" className="stat-label block">
              Action type *
            </label>
            <select id="actionType" name="actionType" required className={adminFormField}>
              <option value="">Select an action…</option>
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-doc-stack--dense">
            <label htmlFor="calldata" className="stat-label block">
              Calldata (raw JSON — optional)
            </label>
            <textarea
              id="calldata"
              name="calldata"
              rows={4}
              placeholder='{"newFeeBps": 250}'
              className={cn(adminFormField, "mono resize-y")}
            />
          </div>

          <div className="admin-doc-stack--dense">
            <label htmlFor="justification" className="stat-label block">
              Justification *{" "}
              <span className="normal-case tracking-normal ct-text-muted">(min 80 characters)</span>
            </label>
            <textarea
              id="justification"
              name="justification"
              rows={5}
              required
              minLength={80}
              placeholder="Explain why this action is necessary, what the expected impact is, and any risk mitigations applied…"
              className={cn(adminFormField, "resize-y")}
            />
          </div>

          <div className="admin-doc-inline-row admin-doc-inline-row--actions pt-2">
            <Button type="submit" variant="primary" size="lg" disabled={vaults.length === 0}>
              Submit proposal
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/admin/governance">Cancel</Link>
            </Button>
          </div>

          <p className="body-xs ct-text-muted">
            Submitting moves the proposal directly to SIGNING state. The proposer&apos;s own
            approval is not automatically counted — sign explicitly in the detail view.
          </p>
        </form>
      </Card>
    </div>
  );
}
