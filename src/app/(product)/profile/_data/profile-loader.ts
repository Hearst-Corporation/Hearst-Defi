// /profile — the server-side loader.
//
// Reads the profile's identity block from hearst-connect-backend over HTTP via
// the SAME data-source path every other migrated surface uses
// (BackendInvestorUiDataSource → getProfileFromBackend → /api/v1/profile).
// Before this loader, the page read KYC straight from Prisma
// (readInvestorKycStatus) — a parallel read path for a fact the backend now
// serves as `identity.kycStatus`.
//
// ── The states this loader returns ──────────────────────────────────────────
//
//   "ok"      the backend answered. `profile.identity` carries the backend's
//             own status THROUGH: LIVE (Investor row), PARTIAL/
//             "no_investor_record" (brand-new account — a PRODUCT state the
//             page renders as such, never as an error), or UNAVAILABLE/
//             "db_error" (the backend reached its DB and failed). The eight
//             blocks the backend does not serve arrive NOT_CONFIGURED with
//             the explicit "no_backend_endpoint" motive.
//   "error"   the request never came back — network, 5xx, timeout, a missing
//             route on an older backend (404), or a bad signing key. "We
//             couldn't reach the data" — deliberately DISTINCT from every
//             state above, because showing "no investor record" during an
//             outage would state something false about the account.
//
// What this loader deliberately does NOT do: it does not read the whitelist.
// Subscription eligibility is a CONTRACT fact (the backend itself reports
// `identity.whitelisted: null` until the v2 contract is readable), and the
// page keeps its direct legacy-contract read for that one block — replacing a
// real on-chain reading with the backend's honest null would trade a true
// value for an absence.

import "server-only";

import { isBackendError } from "@/lib/backend";
import { BackendInvestorUiDataSource } from "@/features/investor-ui/data-source/backend-data-source";
import type { ProfileViewModel } from "@/features/investor-ui/types/profile";
import { logger } from "@/lib/logger";

export interface ProfilePageDataOk {
  readonly state: "ok";
  readonly profile: ProfileViewModel;
}

export interface ProfilePageDataError {
  readonly state: "error";
  /** Operator-facing detail for logs; the page renders a generic honest block. */
  readonly detail: string;
}

export type ProfilePageData = ProfilePageDataOk | ProfilePageDataError;

export async function loadProfilePageData(): Promise<ProfilePageData> {
  try {
    const profile = await new BackendInvestorUiDataSource().getProfile();
    return { state: "ok", profile };
  } catch (e) {
    const detail = isBackendError(e)
      ? `${e.code}${e.status !== null ? ` ${e.status}` : ""} on ${e.path} (request ${e.requestId})`
      : e instanceof Error
        ? e.message
        : "unknown error";

    logger.error("profile: backend read failed", { detail });
    return { state: "error", detail };
  }
}
