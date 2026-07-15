import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * THE min-ticket consistency contract.
 *
 * Background — the failure this file exists to make impossible:
 * the invest form gates the CTA on `amount >= vault.minTicketUsdc`
 * (src/components/vaults/invest-form.tsx), where `vault` comes from the DATA
 * layer. The investor then fires an irreversible on-chain USDC deposit, and
 * only AFTER it settles does `subscribe()` call `validateMinTicket`. If the
 * server's floor is higher than the one the form advertised, the investor's
 * money is gone and no Position is ever created.
 *
 * So the invariant under test is not "the number is 1" — it is:
 *
 *      what the DATA layer exposes  ===  what the SERVER enforces
 *
 * for every configuration. Both sides resolve through
 * src/lib/vaults/min-ticket.ts; these tests drive the REAL data layer
 * (`getVault`, Prisma mocked at the boundary) and the REAL `validateMinTicket`
 * rather than re-implementing either.
 *
 * Env note: Vitest does NOT copy .env / .env.local into `process.env` (Vite only
 * forwards `VITE_`-prefixed vars), so these stubs are the whole truth here —
 * a developer's local .env.local can never flip this suite.
 */

// ── Prisma mocked at the boundary; everything above it is the real code ────

const findFirstDeployment = vi.fn();
const findManyDeployment = vi.fn();
const findFirstSnapshot = vi.fn();
const findManySnapshot = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: {
      findMany: (...a: unknown[]) => findManyDeployment(...a),
      findFirst: (...a: unknown[]) => findFirstDeployment(...a),
    },
    vaultSnapshot: {
      findMany: (...a: unknown[]) => findManySnapshot(...a),
      findFirst: (...a: unknown[]) => findFirstSnapshot(...a),
    },
  },
}));

import { getVault } from "@/lib/data/vaults";
import { validateMinTicket } from "@/lib/positions/subscribe-logic";
import {
  readMinTicketOverride,
  resolveMinTicketUsdc,
} from "@/lib/vaults/min-ticket";
import { SHARE_CLASS_A, SHARE_CLASS_B } from "@/lib/engine/share-class";

const VAULT_ID = "hearst-yield-vault";

/** A real (non-placeholder) VaultDeployment row, shaped as Prisma returns it. */
function makeRow(minTicketUsdc: number) {
  const dec = (n: number) => ({ toNumber: () => n });
  return {
    id: VAULT_ID,
    ticker: "HYV-A",
    name: "Hearst Yield Vault",
    description: "Mining-backed structured yield.",
    strategy: "mining_yield",
    status: "deployed",
    targetApyLowBps: 800,
    targetApyHighBps: 1500,
    minTicketUsdc: dec(minTicketUsdc),
    softLockupDays: 60,
    capacityUsdc: dec(100_000_000),
    mgmtFeeBps: 100,
    perfFeeBps: 1_000,
    hurdleBps: 0,
    spvJurisdiction: "Cayman",
    shareClass: "A",
    regExemption: "Reg S",
    disclaimers: "Projections are not guaranteed.",
    targetMiningBps: 6000,
    targetBtcTacticalBps: 2500,
    targetUsdcBaseBps: 1000,
    targetStableReserveBps: 500,
    // Real on-chain address — a placeholder row would be filtered out.
    contractAddress: "0x1111111111111111111111111111111111111111",
  };
}

/** Resolve the vault exactly as the invest page does. */
async function loadVault() {
  const vault = await getVault(VAULT_ID);
  if (!vault) throw new Error("fixture vault must resolve");
  return vault;
}

/** Clear both names so a test starts from a known "no override" baseline. */
function clearOverride() {
  vi.stubEnv("MIN_TICKET_USDC", "");
  vi.stubEnv("DEMO_MIN_TICKET_USDC", "");
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirstSnapshot.mockResolvedValue(null);
  findManySnapshot.mockResolvedValue([]);
  findManyDeployment.mockResolvedValue([]);
  findFirstDeployment.mockResolvedValue(makeRow(250_000));
  clearOverride();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// THE contract — UI and server agree, or an investor loses money.
// ---------------------------------------------------------------------------

describe("min ticket — the UI floor and the server floor are the same number", () => {
  // Each case is a realistic configuration. `deployed` is the vault's own DB
  // column; `override` is what MIN_TICKET_USDC is set to ("" = not set).
  const cases: Array<{ label: string; deployed: number; override: string }> = [
    { label: "1 USDC pilot floor (the shipped chantier value)", deployed: 250_000, override: "1" },
    { label: "no override at all", deployed: 250_000, override: "" },
    { label: "override equal to the default", deployed: 250_000, override: "250000" },
    { label: "override above the default", deployed: 250_000, override: "1000000" },
    { label: "a vault configured below the class preset", deployed: 100_000, override: "1" },
  ];

  for (const { label, deployed, override } of cases) {
    it(`${label}: the amount the form accepts, subscribe() also accepts`, async () => {
      findFirstDeployment.mockResolvedValue(makeRow(deployed));
      vi.stubEnv("MIN_TICKET_USDC", override);

      const vault = await loadVault();

      // invest-form.tsx gates on `amount >= vault.minTicketUsdc`, so the
      // boundary amount itself MUST clear the server floor. If this ever fails,
      // the investor's on-chain deposit has already settled by the time
      // subscribe() rejects it.
      expect(
        validateMinTicket(vault.minTicketUsdc, "A").ok,
        "server rejected the exact minimum the form advertises",
      ).toBe(true);

      // And the server is not laxer than the form either: just under the
      // displayed minimum must be refused on both sides.
      expect(validateMinTicket(vault.minTicketUsdc - 0.01, "A").ok).toBe(false);
    });
  }

  it("holds for Class B too (the override is class-agnostic, so both classes stay coherent)", async () => {
    // VaultProduct carries ONE minTicketUsdc, but subscribe() accepts a
    // classCode. With an override set, every class collapses onto the override,
    // so the single number the UI shows is valid whichever class is subscribed.
    vi.stubEnv("MIN_TICKET_USDC", "1");
    const vault = await loadVault();

    expect(validateMinTicket(vault.minTicketUsdc, "A").ok).toBe(true);
    expect(validateMinTicket(vault.minTicketUsdc, "B").ok).toBe(true);
  });

  it("without an override, each class keeps its own product floor (A: 250k, B: 1M)", () => {
    clearOverride();

    expect(validateMinTicket(SHARE_CLASS_A.minTicketUsdc, "A").ok).toBe(true);
    expect(validateMinTicket(SHARE_CLASS_A.minTicketUsdc - 1, "A").ok).toBe(false);
    expect(validateMinTicket(SHARE_CLASS_B.minTicketUsdc, "B").ok).toBe(true);
    expect(validateMinTicket(SHARE_CLASS_B.minTicketUsdc - 1, "B").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The env override itself.
// ---------------------------------------------------------------------------

describe("MIN_TICKET_USDC — resolution rules", () => {
  it("IS honored in production (the NODE_ENV gate that made it inert is gone)", async () => {
    // This is the whole point of the change: the deployed contract already has
    // minDeposit() = 1 USDC, but the app used to force 250k in production, so
    // the invest CTA could never produce a deposit.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MIN_TICKET_USDC", "1");

    expect(validateMinTicket(1, "A").ok).toBe(true);
    expect((await loadVault()).minTicketUsdc).toBe(1);
  });

  it("unset = no behaviour change: the vault's own configured minimum is exposed untouched", async () => {
    clearOverride();
    findFirstDeployment.mockResolvedValue(makeRow(100_000));

    // The 250_000 "default" is the BASE (class preset / DB column), never a
    // value this env var injects — otherwise a vault configured at 100k would
    // be silently pushed up to 250k by merely declaring the var.
    expect((await loadVault()).minTicketUsdc).toBe(100_000);
    expect(resolveMinTicketUsdc(SHARE_CLASS_A.minTicketUsdc)).toBe(250_000);
    expect(readMinTicketOverride()).toBeNull();
  });

  it("a malformed value RAISES back to the product default — it can never lower the floor", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MIN_TICKET_USDC", "not-a-number");

    expect(validateMinTicket(1, "A").ok).toBe(false);
    expect(validateMinTicket(SHARE_CLASS_A.minTicketUsdc, "A").ok).toBe(true);
    expect((await loadVault()).minTicketUsdc).toBe(250_000);
    expect(readMinTicketOverride()).toBeNull();
  });

  it("a zero or negative value is refused (a floor of 0 would accept a 0 USDC ticket)", () => {
    for (const bad of ["0", "-5", "-0.01"]) {
      vi.stubEnv("MIN_TICKET_USDC", bad);
      expect(readMinTicketOverride(), `"${bad}" must not become a floor`).toBeNull();
      expect(resolveMinTicketUsdc(250_000)).toBe(250_000);
    }
  });

  it("MIN_TICKET_USDC takes precedence over the deprecated DEMO_MIN_TICKET_USDC alias", () => {
    vi.stubEnv("MIN_TICKET_USDC", "5");
    vi.stubEnv("DEMO_MIN_TICKET_USDC", "9");

    expect(resolveMinTicketUsdc(250_000)).toBe(5);
    expect(readMinTicketOverride()?.source).toBe("MIN_TICKET_USDC");
  });

  it("the legacy alias alone still drives the floor (it is already provisioned in prod)", () => {
    vi.stubEnv("MIN_TICKET_USDC", "");
    vi.stubEnv("DEMO_MIN_TICKET_USDC", "1");

    expect(resolveMinTicketUsdc(250_000)).toBe(1);
    expect(readMinTicketOverride()?.source).toBe("DEMO_MIN_TICKET_USDC");
    // Reported as the legacy source so env.ts can warn about it in production.
  });
});

// ---------------------------------------------------------------------------
// Engine purity — the override must not have leaked into src/lib/engine/*.
// ---------------------------------------------------------------------------

describe("engine purity (non-negotiable #6)", () => {
  it("the share-class presets stay the untouched product defaults", () => {
    vi.stubEnv("MIN_TICKET_USDC", "1");

    // The engine is pure: it has no idea an override exists. Lowering the
    // applicative floor must never rewrite the product's stated terms.
    expect(SHARE_CLASS_A.minTicketUsdc).toBe(250_000);
    expect(SHARE_CLASS_B.minTicketUsdc).toBe(1_000_000);
  });
});
