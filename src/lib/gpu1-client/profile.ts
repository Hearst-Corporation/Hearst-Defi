// src/lib/gpu1-client/profile.ts
//
// Profile domain (M-later). Scaffolded ahead of its GPU1 endpoint. No canonical
// profile DTO exists in gpu1-backend/src/domain yet, so `ProfileDTO` is a minimal
// LOCAL placeholder — the investor identity fields the profile screen needs, each
// wrapped in Resolved<T> so absent/permission-denied states stay honest. Replace
// with the domain DTO once it is promoted into the contract.

import { gpu1Fetch } from "./client";
import type { Resolved } from "./schemas";

/** LOCAL placeholder for the profile view DTO until it lands in the domain contract. */
export interface ProfileDTO {
  readonly displayName: Resolved<string>;
  readonly email: Resolved<string>;
  /** KYC status label (e.g. "approved" | "pending" | "not_started"). */
  readonly kycStatus: Resolved<string>;
  readonly whitelisted: Resolved<boolean>;
}

/** GET /api/v1/profile — the signed-in investor's profile. */
export function getProfile(): Promise<ProfileDTO> {
  return gpu1Fetch<ProfileDTO>("/api/v1/profile");
}
