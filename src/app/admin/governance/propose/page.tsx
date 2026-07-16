import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { BentoLabel } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Field, FieldDescription } from "@/components/catalyst/field";
import { Select } from "@/components/catalyst/select";
import { Textarea } from "@/components/catalyst/textarea";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { proposeAction } from "@/lib/governance/actions";

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
  const vaults = await prisma.vaultDeployment.findMany({
    where: { status: { not: "closed" } },
    orderBy: { ticker: "asc" },
    select: { id: true, ticker: true, name: true },
  });

  return (
    <AdminPageShell
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
    >
      <AdminSectionCard
        ariaLabel="Proposal form"
        title="Proposal details"
        subtitle="Select the vault and describe the governance action to draft."
      >
        <div className="p-5 lg:p-6">
          <form action={handlePropose} className="flex flex-col gap-5">
            <Field>
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
                <Select id="vaultId" name="vaultId" required defaultValue="">
                  <option value="">Select a vault…</option>
                  {vaults.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.ticker} — {v.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field>
              <BentoLabel htmlFor="actionType">Action type *</BentoLabel>
              <Select id="actionType" name="actionType" required defaultValue="">
                <option value="">Select an action…</option>
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <BentoLabel htmlFor="calldata">
                Calldata (raw JSON — optional)
              </BentoLabel>
              <Textarea
                id="calldata"
                name="calldata"
                rows={4}
                placeholder='{"newFeeBps": 250}'
                className="mono"
              />
            </Field>

            <Field>
              <BentoLabel htmlFor="justification">Justification *</BentoLabel>
              <Textarea
                id="justification"
                name="justification"
                rows={5}
                required
                minLength={80}
                placeholder="Explain why this action is necessary, what the expected impact is, and any risk mitigations applied…"
              />
              <FieldDescription>Min 80 characters.</FieldDescription>
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <CockpitButton
                type="submit"
                variant="primary"
                shape="rect"
                size="lg"
                disabled={vaults.length === 0}
              >
                Submit proposal
              </CockpitButton>
              <CockpitButton
                href="/admin/governance"
                variant="secondary"
                shape="rect"
                size="lg"
              >
                Cancel
              </CockpitButton>
            </div>

            <FieldDescription>
              Submitting moves the proposal directly to SIGNING state. The
              proposer&apos;s own approval is not automatically counted — sign
              explicitly in the detail view.
            </FieldDescription>
          </form>
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
