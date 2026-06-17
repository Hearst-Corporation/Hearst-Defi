"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { VaultForm, type FormState } from "../_vault-form";

type Step =
  | "identity"
  | "economics"
  | "allocations"
  | "legal"
  | "governance"
  | "review_simulate"
  | "sign_deploy";

interface VaultWizardProps {
  resumeStep?: Step;
  resumeForm?: Partial<FormState>;
  /** Pre-fill values derived from a ?cloneFrom= query param. Applied after
   *  resumeForm so a persisted draft (explicit resume) takes precedence. */
  cloneValues?: Partial<FormState>;
  /** Authenticated admin's signer identity, surfaced in the Governance step. */
  adminId?: string;
}

/**
 * VaultWizard — thin wrapper kept for backward-compat with new/page.tsx.
 * All form logic lives in `../_vault-form.tsx`.
 */
export function VaultWizard({ resumeStep, resumeForm, cloneValues, adminId }: VaultWizardProps) {
  const router = useRouter();

  // P0-04 — pin `?resume=1` into the URL once the wizard is mounted and active.
  // page.tsx re-evaluates its `showGate` on every RSC refetch (the page is
  // force-dynamic, and each autosave server action triggers a refetch). On a
  // fresh start the URL carries no `resume` param, so the moment step 1–4
  // autosave CREATES a draft, the next refetch would flip showGate back to true
  // and replace the wizard with the ResumeDraftBanner — making steps 5–7
  // unreachable. Stamping `resume=1` keeps the gate satisfied for the rest of
  // the session, without affecting genuine return visits (which arrive with no
  // param and correctly see the banner).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("resume") !== "1") {
      sp.set("resume", "1");
      router.replace(`/admin/vaults/new?${sp.toString()}`);
    }
  }, [router]);

  // Merge order: FORM_INITIAL < cloneValues < resumeForm (explicit draft wins)
  const mergedResume: Partial<FormState> | undefined =
    cloneValues ?? resumeForm
      ? { ...cloneValues, ...resumeForm }
      : undefined;

  return (
    <VaultForm
      mode="create"
      resumeStep={resumeStep}
      resumeForm={mergedResume}
      adminId={adminId}
    />
  );
}
