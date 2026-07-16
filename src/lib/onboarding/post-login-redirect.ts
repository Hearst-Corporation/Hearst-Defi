import "server-only";

import { safeFrom } from "@/lib/safe-redirect";

/**
 * resolvePostLoginRedirect
 *
 * Where a freshly-authenticated user should land.
 *
 * Model: `/apply` is the qualification funnel that GRANTS ACCESS to the
 * platform. Once the account is activated (set password), the user enters the
 * platform directly — they land on `/dashboard`, NOT in a blocking onboarding
 * funnel. Onboarding (accreditation → KYC → wallet) is completed *inside* the
 * platform and is NOT a gate on entry; it is only a gate on the sensitive
 * action (investing / depositing), enforced at `/vaults/[id]/invest`.
 *
 * - An explicit, validated deep link (`from`) always wins.
 * - Otherwise everyone — onboarded or not — lands on the platform default
 *   (`/dashboard`, the V2 rail entry point). We deliberately do NOT divert
 *   un-attested investors into `/onboarding/accreditation` here anymore.
 */
export async function resolvePostLoginRedirect(
  _userId: string,
  from?: string,
): Promise<string> {
  // An explicit, validated deep link always wins.
  if (from && safeFrom(from, "") !== "") {
    return safeFrom(from);
  }

  // Everyone enters the platform directly. Onboarding lives inside the platform
  // and only gates investing, not entry.
  return "/dashboard";
}
