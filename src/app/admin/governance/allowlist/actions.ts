"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  addAllowlistEntry,
  updateAllowlistEntry,
  type AllowlistCategory,
} from "@/lib/governance/allowlist";

export async function addAllowlistEntryAction(formData: FormData) {
  await requireAdmin();
  const address = (formData.get("address") as string).trim();
  const label = (formData.get("label") as string).trim();
  const category = formData.get("category") as AllowlistCategory;
  const notes = (formData.get("notes") as string | null)?.trim() || undefined;
  const riskScoreRaw = formData.get("riskScore") as string;
  const riskScore = riskScoreRaw ? parseInt(riskScoreRaw, 10) : 0;

  await addAllowlistEntry({ address, label, category, notes, riskScore });
}

export async function updateAllowlistEntryAction(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const label = (formData.get("label") as string | null)?.trim();
  const notes = (formData.get("notes") as string | null)?.trim() || undefined;
  const riskScoreRaw = formData.get("riskScore") as string | null;
  const riskScore = riskScoreRaw ? parseInt(riskScoreRaw, 10) : undefined;

  await updateAllowlistEntry({ id, ...(label ? { label } : {}), notes, riskScore });
}

export async function toggleAllowlistEntryAction(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const currentActive = formData.get("active") === "true";
  await updateAllowlistEntry({ id, active: !currentActive });
}
