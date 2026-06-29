import { describe, expect, it } from "vitest";

import {
  runPersistenceDiagnostics,
  type RollbackProbe,
} from "@/lib/admin/diagnostics/persistence-diagnostics";

const okProbe: RollbackProbe = {
  executed: true,
  beforeCount: 7,
  inTxCount: 8,
  afterCount: 7,
  rolledBack: true,
  persisted: false,
};

describe("persistence diagnostics", () => {
  it("SKIPS the rollback-seam check without an injected probe", () => {
    const noDeps = runPersistenceDiagnostics();
    expect(noDeps.find((r) => r.id === "persist.rollback-seam")?.status).toBe(
      "skipped",
    );
    // never claims a fail when un-probed
    expect(noDeps.filter((r) => r.status === "fail")).toHaveLength(0);
  });

  it("PASSES when the injected probe shows create-in-tx then rolled-back", () => {
    const r = runPersistenceDiagnostics({ rollbackProbe: okProbe });
    const seam = r.find((x) => x.id === "persist.rollback-seam");
    expect(seam?.status).toBe("pass");
    expect(seam?.sideEffect).toBe("rolled-back");
  });

  it("FAILS honestly if a row would have persisted (no fake green)", () => {
    const leaked: RollbackProbe = {
      ...okProbe,
      afterCount: 8,
      persisted: true,
      rolledBack: false,
    };
    const r = runPersistenceDiagnostics({ rollbackProbe: leaked });
    expect(r.find((x) => x.id === "persist.rollback-seam")?.status).toBe("fail");
  });

  it("keeps action-level writes honestly skipped (no tx-capable seam)", () => {
    const r = runPersistenceDiagnostics({ rollbackProbe: okProbe });
    expect(
      r.find((x) => x.id === "persist.actions-not-tx-capable")?.status,
    ).toBe("skipped");
  });
});
