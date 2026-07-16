// src/lib/gpu1-client/subscription.ts
//
// Subscription domain (M-later). Scaffolded ahead of its GPU1 endpoint. No
// canonical subscription DTO exists in gpu1-backend/src/domain yet, so
// `SubscriptionDTO` is a minimal LOCAL placeholder that reuses the canonical
// VaultCapacity (subscription window / minimum ticket / utilization) behind the
// Resolved<T> envelope. Replace with the domain DTO once it is promoted.

import { gpu1Fetch } from "./client";
import type { Resolved, VaultCapacity } from "./schemas";

/** LOCAL placeholder for the subscription view DTO until it lands in the domain contract. */
export interface SubscriptionDTO {
  /** Capacity / window drives whether subscription is open and the minimum ticket. */
  readonly capacity: Resolved<VaultCapacity>;
  /** Whether the signed-in investor is cleared to subscribe. */
  readonly eligible: Resolved<boolean>;
}

/** GET /api/v1/subscription — subscription window + eligibility. */
export function getSubscription(): Promise<SubscriptionDTO> {
  return gpu1Fetch<SubscriptionDTO>("/api/v1/subscription");
}
