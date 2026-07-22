// /vaults/[id]/invest/confirmed — position resolution loader.
//
// Moves the bare `prisma.position` read out of the page body: pages consume
// loaders, loaders own the data access. Semantics unchanged from the page's
// original inline read:
//   • the positionId arrives via the URL and is untrusted — it resolves ONLY
//     when it belongs to the signed-in investor;
//   • a transient DB failure degrades to the same "position not resolved"
//     state as a missing/foreign id (never a 500, never a fabricated row).
// The backend serves no per-user position route in v1 — replacing this real
// read with null would be the inverse regression.

import "server-only";

import { prisma } from "@/lib/db";

export interface ConfirmedPosition {
  readonly subscribedAt: Date;
  readonly principalUsdc: number;
}

export async function loadOwnedPosition(
  positionId: string | undefined,
  investorId: string | null,
): Promise<ConfirmedPosition | null> {
  if (!positionId || !investorId) return null;
  const row = await prisma.position
    .findFirst({
      where: { id: positionId, investorId },
      select: { subscribedAt: true, principalUsdc: true },
    })
    .catch(() => null);
  if (!row) return null;
  return { subscribedAt: row.subscribedAt, principalUsdc: Number(row.principalUsdc) };
}
