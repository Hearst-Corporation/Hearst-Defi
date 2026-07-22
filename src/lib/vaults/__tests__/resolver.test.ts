import { describe, expect, it, vi, beforeEach } from "vitest";

const { findFirstMock, findManyMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: {
      findFirst: findFirstMock,
      findMany: findManyMock,
    },
  },
}));

import {
  resolveVault,
  resolveFixture,
  listAllVaults,
  vaultSlug,
  vaultLabel,
} from "../resolver";

const DEPLOYMENT_ROW = {
  id: "cmx7abcde1234567",
  ticker: "HYV-A",
  name: "Hearst Yield Vault — Series A",
  status: "live",
  updatedAt: new Date("2026-05-26T10:00:00Z"),
} as const;

beforeEach(() => {
  findFirstMock.mockReset();
  findManyMock.mockReset();
  findManyMock.mockResolvedValue([]);
});

describe("resolveFixture", () => {
  it("resolves VaultId enum direct match", () => {
    expect(resolveFixture("yield")?.id).toBe("yield");
    expect(resolveFixture("defensive")?.id).toBe("defensive");
    expect(resolveFixture("btc-plus")?.id).toBe("btc-plus");
  });

  it("resolves fixture ticker case-insensitive", () => {
    expect(resolveFixture("HYV")?.id).toBe("yield");
    expect(resolveFixture("hyv")?.id).toBe("yield");
    expect(resolveFixture("hdv")?.id).toBe("defensive");
    expect(resolveFixture("HBP")?.id).toBe("btc-plus");
  });

  it("returns null for unknown input", () => {
    expect(resolveFixture("")).toBeNull();
    expect(resolveFixture("   ")).toBeNull();
    expect(resolveFixture("HYV-A")).toBeNull();
    expect(resolveFixture("unknown")).toBeNull();
  });
});

describe("resolveVault", () => {
  it("returns a fixture ref for VaultId match (no DB hit)", async () => {
    const ref = await resolveVault("yield");
    expect(ref?.kind).toBe("fixture");
    if (ref?.kind === "fixture") expect(ref.fixture.id).toBe("yield");
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("returns a fixture ref for fixture ticker (no DB hit)", async () => {
    const ref = await resolveVault("HYV");
    expect(ref?.kind).toBe("fixture");
    if (ref?.kind === "fixture") expect(ref.fixture.ticker).toBe("HYV");
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("falls back to Prisma when input is a deployment ticker", async () => {
    findFirstMock.mockResolvedValueOnce(DEPLOYMENT_ROW);
    const ref = await resolveVault("HYV-A");
    expect(ref?.kind).toBe("deployment");
    if (ref?.kind === "deployment")
      expect(ref.deployment.ticker).toBe("HYV-A");
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { OR: [{ ticker: "HYV-A" }, { id: "HYV-A" }] },
    });
  });

  it("uppercases the ticker before Prisma lookup", async () => {
    findFirstMock.mockResolvedValueOnce(DEPLOYMENT_ROW);
    await resolveVault("hyv-a");
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { OR: [{ ticker: "HYV-A" }, { id: "hyv-a" }] },
    });
  });

  it("returns null when Prisma has no match", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    expect(await resolveVault("UNKNOWN-X")).toBeNull();
  });

  it("returns null for empty input without DB hit", async () => {
    expect(await resolveVault("")).toBeNull();
    expect(await resolveVault("   ")).toBeNull();
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});

describe("listAllVaults", () => {
  it("returns the 3 fixtures first, then deployments", async () => {
    findManyMock.mockResolvedValueOnce([DEPLOYMENT_ROW]);
    const refs = await listAllVaults();
    expect(refs).toHaveLength(4);
    expect(refs.slice(0, 3).map((r) => r.kind)).toEqual([
      "fixture",
      "fixture",
      "fixture",
    ]);
    expect(refs[3]?.kind).toBe("deployment");
  });

  it("hides deployments whose ticker collides with a fixture", async () => {
    findManyMock.mockResolvedValueOnce([
      { ...DEPLOYMENT_ROW, ticker: "HYV" },
      DEPLOYMENT_ROW,
    ]);
    const refs = await listAllVaults();
    const deployments = refs.filter((r) => r.kind === "deployment");
    expect(deployments).toHaveLength(1);
    if (deployments[0]?.kind === "deployment")
      expect(deployments[0].deployment.ticker).toBe("HYV-A");
  });

  it("hides deployments whose name collides with a fixture label (case-insensitive)", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        ...DEPLOYMENT_ROW,
        ticker: "HYV-CLONE",
        name: "  hearst yield vault  ",
      },
      { ...DEPLOYMENT_ROW, ticker: "HDV-CLONE", name: "Hearst Defensive Vault" },
      DEPLOYMENT_ROW,
    ]);
    const refs = await listAllVaults();
    expect(refs).toHaveLength(4);
    const deployments = refs.filter((r) => r.kind === "deployment");
    expect(deployments).toHaveLength(1);
    if (deployments[0]?.kind === "deployment")
      expect(deployments[0].deployment.ticker).toBe("HYV-A");
  });

  it("hides deployments whose id matches a VaultId fixture", async () => {
    findManyMock.mockResolvedValueOnce([
      { ...DEPLOYMENT_ROW, id: "yield", ticker: "HYV-X", name: "Custom Yield" },
      DEPLOYMENT_ROW,
    ]);
    const refs = await listAllVaults();
    const deployments = refs.filter((r) => r.kind === "deployment");
    expect(deployments).toHaveLength(1);
    if (deployments[0]?.kind === "deployment")
      expect(deployments[0].deployment.id).toBe(DEPLOYMENT_ROW.id);
  });

  it("dedupes duplicate deployment rows sharing ticker + name", async () => {
    findManyMock.mockResolvedValueOnce([DEPLOYMENT_ROW, DEPLOYMENT_ROW]);
    const refs = await listAllVaults();
    const deployments = refs.filter((r) => r.kind === "deployment");
    expect(deployments).toHaveLength(1);
  });

  it("status=live narrows the Prisma where clause", async () => {
    await listAllVaults({ status: "live" });
    expect(findManyMock).toHaveBeenCalledWith({
      where: { status: "live" },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("status=any drops the where clause", async () => {
    await listAllVaults({ status: "any" });
    expect(findManyMock).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { updatedAt: "desc" },
    });
  });

  it("status=live-or-paused uses IN filter", async () => {
    await listAllVaults({ status: "live-or-paused" });
    expect(findManyMock).toHaveBeenCalledWith({
      where: { status: { in: ["live", "paused"] } },
      orderBy: { updatedAt: "desc" },
    });
  });
});

describe("vaultSlug + vaultLabel", () => {
  it("uses VaultId for fixtures", async () => {
    const ref = await resolveVault("yield");
    expect(ref && vaultSlug(ref)).toBe("yield");
    // The technical id stays "yield" (compat key), but the label is the
    // Series 1 canon — "Yield Vault" named a cash-yield product this
    // BTC-accumulation note is not.
    expect(ref && vaultLabel(ref)).toBe("Hearst Bitcoin Reserve Vault — Series 1");
  });

  it("uses lowercased ticker for deployments", async () => {
    findFirstMock.mockResolvedValueOnce(DEPLOYMENT_ROW);
    const ref = await resolveVault("HYV-A");
    expect(ref && vaultSlug(ref)).toBe("hyv-a");
    expect(ref && vaultLabel(ref)).toBe("Hearst Yield Vault — Series A");
  });
});
