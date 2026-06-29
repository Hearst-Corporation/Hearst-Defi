import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock the prisma client used by the rollback seam. $transaction runs the
// interactive callback; when the callback throws, it re-throws (real Prisma
// semantics: a thrown error rolls back and propagates). No commit step exists,
// so this faithfully models "never commits".
const txCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ adminAudit: { create: txCreate } }),
    ),
  },
}));

import { runInRollbackTransaction } from "@/lib/admin/diagnostics/safe-dry-run";

describe("runInRollbackTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures the callback value and ALWAYS rolls back (never commits)", async () => {
    const res = await runInRollbackTransaction(async () => 42);
    expect(res.rolledBack).toBe(true);
    expect(res.value).toBe(42);
    expect(res.error).toBeUndefined();
  });

  it("runs the callback's writes inside the tx but rolls them back", async () => {
    const res = await runInRollbackTransaction(async (tx) => {
      await (
        tx as unknown as { adminAudit: { create: typeof txCreate } }
      ).adminAudit.create({ data: { x: 1 } });
      return "done";
    });
    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(res.rolledBack).toBe(true);
    expect(res.value).toBe("done");
  });

  it("surfaces a real error (not a rollback) when the callback throws", async () => {
    const res = await runInRollbackTransaction(async () => {
      throw new Error("boom");
    });
    expect(res.rolledBack).toBe(false);
    expect(res.error).toContain("boom");
  });
});
