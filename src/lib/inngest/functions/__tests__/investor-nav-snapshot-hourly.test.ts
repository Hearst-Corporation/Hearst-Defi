import { describe, expect, it, vi, beforeEach } from "vitest";

const captureAllMock = vi.fn();

vi.mock("@/lib/portfolio/investor-nav-snapshot", () => ({
  captureAllInvestorNavSnapshots: captureAllMock,
}));

const isDuplicateMock = vi.fn(async () => false);
const markCompleteMock = vi.fn(async () => undefined);

vi.mock("@/lib/idempotency", () => ({
  isDuplicate: isDuplicateMock,
  markComplete: markCompleteMock,
}));

const stepShim = {
  run: <T,>(_name: string, fn: () => T | Promise<T>): Promise<T> =>
    Promise.resolve(fn()),
};

describe("investorNavSnapshotHourly Inngest function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDuplicateMock.mockResolvedValue(false);
    captureAllMock.mockResolvedValue({ captured: 3, skipped: 1 });
  });

  it("captures NAV for all investors then marks complete", async () => {
    const { investorNavSnapshotHourlyHandler, INVESTOR_NAV_SNAPSHOT_HOURLY_CRON } =
      await import("../investor-nav-snapshot-hourly");

    expect(INVESTOR_NAV_SNAPSHOT_HOURLY_CRON).toBe("10 * * * *");

    const result = await investorNavSnapshotHourlyHandler({ step: stepShim });

    expect(result).toEqual({ captured: 3, skipped: 1 });
    expect(captureAllMock).toHaveBeenCalledOnce();
    expect(markCompleteMock).toHaveBeenCalledOnce();
  });

  it("skips when idempotency guard fires", async () => {
    isDuplicateMock.mockResolvedValue(true);
    const { investorNavSnapshotHourlyHandler } = await import("../investor-nav-snapshot-hourly");

    const result = await investorNavSnapshotHourlyHandler({ step: stepShim });

    expect(result).toEqual({ skipped: true, reason: "already_run_this_hour" });
    expect(captureAllMock).not.toHaveBeenCalled();
  });
});
