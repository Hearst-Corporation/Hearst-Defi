import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { PanelStatus } from "@/components/catalyst/panel-status";
import { requireAdmin } from "@/lib/auth/require-admin";
import { resolveVault } from "@/lib/vaults/resolver";
import { cloneFormValues } from "@/lib/vaults/clone";
import { decodeVaultFormPrefill } from "@/lib/agentic/swarm/live/to-vault-form";
import { loadWizardDraft } from "../draft-actions";
import { VaultWizard } from "./wizard";
import { ResumeDraftBanner } from "./resume-banner";
import type { FormState } from "../_vault-form";

export const dynamic = "force-dynamic";

type Step =
  | "identity"
  | "economics"
  | "allocations"
  | "legal"
  | "governance"
  | "review_simulate"
  | "sign_deploy";

const STEP_LABELS: Record<Step, string> = {
  identity: "Identity & Strategy",
  economics: "Economics",
  allocations: "Allocations",
  legal: "Legal & SPV",
  governance: "Governance",
  review_simulate: "Review & Simulate",
  sign_deploy: "Sign & Deploy",
};

const STEP_NUMBERS: Record<Step, number> = {
  identity: 1,
  economics: 2,
  allocations: 3,
  legal: 4,
  governance: 5,
  review_simulate: 6,
  sign_deploy: 7,
};

interface NewVaultPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewVaultPage({ searchParams }: NewVaultPageProps) {
  const admin = await requireAdmin();
  const adminId = admin.walletAddress ?? admin.userId;

  const [draft, params] = await Promise.all([
    loadWizardDraft(),
    searchParams,
  ]);

  let resumeStep: Step | undefined;
  let resumeForm: Partial<FormState> | undefined;
  let draftUpdatedAt: Date | undefined;

  if (draft) {
    const rawStep = draft.step as Step;
    if (rawStep in STEP_LABELS) {
      resumeStep = rawStep;
    }
    try {
      resumeForm = JSON.parse(draft.formState) as Partial<FormState>;
    } catch {
      resumeForm = undefined;
    }
    draftUpdatedAt = draft.updatedAt;
  }

  // Resolve ?cloneFrom=<vaultIdOrSlug>. If the reference doesn't resolve, the
  // wizard still opens (fix-forward, never a hard block) but the admin is told
  // explicitly — otherwise a typo'd/deleted vault ref silently produced a blank
  // wizard indistinguishable from "cloning nothing on purpose".
  let cloneValues: Partial<FormState> | undefined;
  let cloneNotFound: string | undefined;
  const rawCloneFrom = params["cloneFrom"];
  const cloneFrom = typeof rawCloneFrom === "string" ? rawCloneFrom.trim() : "";
  if (cloneFrom.length > 0) {
    const sourceRef = await resolveVault(cloneFrom);
    if (sourceRef) {
      cloneValues = cloneFormValues(sourceRef);
    } else {
      cloneNotFound = cloneFrom;
    }
  }

  // Resolve ?prefill=<base64> — a product-construction draft handed off from the
  // Product Workspace. Pure URL handoff: nothing was persisted, the decode is
  // whitelisted + clamped (decodeVaultFormPrefill), and the values seed the form
  // exactly like a clone. The admin still completes fees/SPV/signers + signs.
  let prefillInvalid = false;
  if (!cloneValues) {
    const rawPrefill = params["prefill"];
    if (typeof rawPrefill === "string" && rawPrefill.length > 0) {
      const prefill = decodeVaultFormPrefill(rawPrefill);
      if (prefill) {
        cloneValues = prefill as Partial<FormState>;
      } else {
        prefillInvalid = true;
      }
    }
  }

  const stepLabel = resumeStep ? STEP_LABELS[resumeStep] : undefined;
  const stepNumber = resumeStep ? STEP_NUMBERS[resumeStep] : undefined;

  // Gate: when a draft exists, the admin must explicitly opt into resuming it
  // (via ?resume=1) before the wizard mounts with pre-filled data. Without this
  // gate, opening /admin/vaults/new silently rehydrated the previous session
  // and admins edited stale drafts by accident.
  const rawResume = params["resume"];
  const resumeAcknowledged =
    typeof rawResume === "string" && (rawResume === "1" || rawResume === "true");

  const showGate =
    Boolean(draft && resumeStep && resumeForm && draftUpdatedAt && stepLabel && stepNumber) &&
    !resumeAcknowledged;

  const applyResume = resumeAcknowledged ? resumeStep : undefined;
  const applyResumeForm = resumeAcknowledged ? resumeForm : undefined;

  return (
    <AdminPageShell titleLead="New" titleAccent="Vault Deployment">
      {showGate && resumeForm && draftUpdatedAt && stepLabel && stepNumber ? (
        <ResumeDraftBanner
          ticker={
            typeof resumeForm.ticker === "string" && resumeForm.ticker.length > 0
              ? resumeForm.ticker
              : undefined
          }
          stepLabel={stepLabel}
          stepNumber={stepNumber}
          updatedAt={draftUpdatedAt}
        />
      ) : (
        <>
          {cloneNotFound ? (
            <PanelStatus
              tone="danger"
              role="alert"
              message={`Clone source "${cloneNotFound}" not found`}
              detail="No vault matched that reference — the wizard did not pre-fill from it."
              className="mb-4"
            />
          ) : null}
          {prefillInvalid ? (
            <PanelStatus
              tone="danger"
              role="alert"
              message="Prefill link could not be read"
              detail="The handoff link was malformed or expired — the wizard did not pre-fill from it."
              className="mb-4"
            />
          ) : null}
          <VaultWizard
            resumeStep={applyResume}
            resumeForm={applyResumeForm}
            cloneValues={cloneValues}
            adminId={adminId}
          />
        </>
      )}
    </AdminPageShell>
  );
}
