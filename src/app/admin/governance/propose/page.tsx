import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { Button } from "@/components/catalyst/button";
import { EmptySurface } from "@/components/ui/empty-surface";
import { BentoLabel, BENTO_SECONDARY_BTN } from "@/components/ui/bento";
import { CATALYST_ACCENT_BTN } from "@/lib/ui/catalyst-accent";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { proposeAction } from "@/lib/governance/actions";
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

// Portfolio-canon field chrome: dark sub-surface, hairline border, accent focus.
const FIELD =
  "w-full rounded-lg border border-[var(--ct-border)] bg-surface-inset px-3 py-2.5 text-[length:var(--ct-text-sm)] text-[var(--ct-text-strong)] placeholder:text-[var(--ct-text-faint)] transition-colors focus:border-[var(--ct-border-accent)] focus:outline-none";

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
  const vaults = await prisma.vaultDeployment.findMany({
    where: { status: { not: "closed" } },
    orderBy: { ticker: "asc" },
    select: { id: true, ticker: true, name: true },
  });

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="New"
          titleAccent="Proposal"
          contextLabel="Governance · Proposal"
          lead={
            <Link
              href="/admin/governance"
              className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]"
              aria-label="Back to governance"
            >
              ← Governance
            </Link>
          }
        />

        <AdminSectionCard ariaLabel="Proposal form" title="Proposal details">
          <div className="p-5 lg:p-6">
            <form action={handlePropose} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="vaultId">Vault *</BentoLabel>
                {vaults.length === 0 ? (
                  <EmptySurface
                    variant="inline"
                    message="No vaults available yet."
                    detail="Create a vault deployment before drafting a governance proposal."
                    ariaLabel="Governance proposals awaiting vaults"
                  >
                    <Link
                      href="/admin/vaults/new"
                      className="text-[var(--ct-accent)] underline underline-offset-2"
                    >
                      Create a vault first.
                    </Link>
                  </EmptySurface>
                ) : (
                  <select id="vaultId" name="vaultId" required className={FIELD}>
                    <option value="">Select a vault…</option>
                    {vaults.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.ticker} — {v.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="actionType">Action type *</BentoLabel>
                <select id="actionType" name="actionType" required className={FIELD}>
                  <option value="">Select an action…</option>
                  {ACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="calldata">
                  Calldata (raw JSON — optional)
                </BentoLabel>
                <textarea
                  id="calldata"
                  name="calldata"
                  rows={4}
                  placeholder='{"newFeeBps": 250}'
                  className={cn(FIELD, "resize-y font-mono")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="justification">Justification *</BentoLabel>
                <textarea
                  id="justification"
                  name="justification"
                  rows={5}
                  required
                  minLength={80}
                  placeholder="Explain why this action is necessary, what the expected impact is, and any risk mitigations applied…"
                  className={cn(FIELD, "resize-y")}
                />
                <span className="ct-metric-caption">Min 80 characters.</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  className={CATALYST_ACCENT_BTN}
                  disabled={vaults.length === 0}
                >
                  Submit proposal
                </Button>
                <Link href="/admin/governance" className={BENTO_SECONDARY_BTN}>
                  Cancel
                </Link>
              </div>

              <p className="ct-metric-caption">
                Submitting moves the proposal directly to SIGNING state. The
                proposer&apos;s own approval is not automatically counted — sign
                explicitly in the detail view.
              </p>
            </form>
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
}
