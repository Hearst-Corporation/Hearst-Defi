// Demo builder — customers list.
//
// Called by loadCustomers() when canRunDemoProvider() is true. Returns the
// SAME PaginatedResult<CustomerRow> shape as the real Prisma loader so the
// admin customers page is completely unaware of the substitution.
//
// No real PII. Emails use the @demo.hearst sentinel domain. IDs are stable
// string literals (no UUID generation) so pagination is deterministic.

import {
  clampPageSize,
  toPaginatedResult,
  type PaginatedResult,
} from "@/lib/pagination";
import { type CustomerRow, type KycStatus } from "@/lib/data/customers";

// ---------------------------------------------------------------------------
// Static demo roster — 8 institutional investor profiles.
// ---------------------------------------------------------------------------

const DEMO_ROWS: CustomerRow[] = [
  {
    id: "demo-cust-001",
    email: "blackrock.pm@demo.hearst",
    walletAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    kycStatus: "approved" as KycStatus,
    activePositions: 2,
    totalPrincipalUsdc: 1_500_000,
    joinedAt: new Date("2025-11-04T09:00:00Z"),
  },
  {
    id: "demo-cust-002",
    email: "citadel.treasury@demo.hearst",
    walletAddress: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
    kycStatus: "approved" as KycStatus,
    activePositions: 1,
    totalPrincipalUsdc: 750_000,
    joinedAt: new Date("2025-11-18T14:30:00Z"),
  },
  {
    id: "demo-cust-003",
    email: "galaxy.digital@demo.hearst",
    walletAddress: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
    kycStatus: "approved" as KycStatus,
    activePositions: 1,
    totalPrincipalUsdc: 500_000,
    joinedAt: new Date("2025-12-01T10:15:00Z"),
  },
  {
    id: "demo-cust-004",
    email: "pantera.capital@demo.hearst",
    walletAddress: null,
    kycStatus: "pending" as KycStatus,
    activePositions: 0,
    totalPrincipalUsdc: 0,
    joinedAt: new Date("2026-01-07T08:00:00Z"),
  },
  {
    id: "demo-cust-005",
    email: "multicoin.capital@demo.hearst",
    walletAddress: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
    kycStatus: "approved" as KycStatus,
    activePositions: 3,
    totalPrincipalUsdc: 2_250_000,
    joinedAt: new Date("2026-01-15T11:45:00Z"),
  },
  {
    id: "demo-cust-006",
    email: "arkhangelsk.fund@demo.hearst",
    walletAddress: null,
    kycStatus: "pending" as KycStatus,
    activePositions: 0,
    totalPrincipalUsdc: 0,
    joinedAt: new Date("2026-02-03T16:00:00Z"),
  },
  {
    id: "demo-cust-007",
    email: "dragonfly.ventures@demo.hearst",
    walletAddress: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    kycStatus: "approved" as KycStatus,
    activePositions: 1,
    totalPrincipalUsdc: 1_000_000,
    joinedAt: new Date("2026-02-20T09:30:00Z"),
  },
  {
    id: "demo-cust-008",
    email: "greyhound.asset.mgmt@demo.hearst",
    walletAddress: "0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f",
    kycStatus: "pending" as KycStatus,
    activePositions: 0,
    totalPrincipalUsdc: 0,
    joinedAt: new Date("2026-03-10T12:00:00Z"),
  },
];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Returns a paginated slice of demo customer rows.
 * Mirrors the exact signature and return type of the real `loadCustomers()`.
 */
export function buildDemoCustomers(
  page: number,
  pageSize: number,
): Promise<PaginatedResult<CustomerRow>> {
  const ps = clampPageSize(pageSize);
  const p = Math.max(page, 1);

  const total = DEMO_ROWS.length;
  const start = (p - 1) * ps;
  const slice = DEMO_ROWS.slice(start, start + ps);

  return Promise.resolve(toPaginatedResult(slice, total, p, ps));
}
