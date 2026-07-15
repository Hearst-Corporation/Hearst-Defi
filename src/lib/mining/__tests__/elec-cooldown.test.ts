import { describe, expect, it } from "vitest";

import {
  deriveElecCooldown,
  ELEC_COOLDOWN_DAYS,
  ELEC_COOLDOWN_SECONDS,
} from "@/lib/mining/elec-cooldown";

/** Arbitrary fixed "now", unix seconds. The function takes its clock by
 *  injection, so these tests need no fake timers. */
const NOW = 1_800_000_000n;
const ONE_DAY = 86_400n;

describe("deriveElecCooldown", () => {
  it("treats a zero timestamp as never paid, without fabricating a 1970 date", () => {
    const cooldown = deriveElecCooldown(0n, NOW);

    expect(cooldown.neverPaid).toBe(true);
    expect(cooldown.canPay).toBe(true);
    expect(cooldown.remainingSeconds).toBe(0);
    // The sentinel must not surface as a real timestamp.
    expect(cooldown.lastPaymentTime).toBeNull();
    expect(cooldown.cooldownEndsAt).toBeNull();
    expect(cooldown.clockAnomaly).toBe(false);
  });

  it("reports the full window immediately after a payment", () => {
    const cooldown = deriveElecCooldown(NOW, NOW);

    expect(cooldown.remainingSeconds).toBe(ELEC_COOLDOWN_SECONDS);
    expect(cooldown.canPay).toBe(false);
    expect(cooldown.neverPaid).toBe(false);
    expect(cooldown.lastPaymentTime).toBe(NOW.toString());
    expect(cooldown.cooldownEndsAt).toBe(
      (NOW + BigInt(ELEC_COOLDOWN_SECONDS)).toString(),
    );
  });

  it("counts down inside the window", () => {
    const cooldown = deriveElecCooldown(NOW - ONE_DAY, NOW);

    expect(cooldown.remainingSeconds).toBe(
      ELEC_COOLDOWN_SECONDS - Number(ONE_DAY),
    );
    expect(cooldown.canPay).toBe(false);
  });

  it("opens payment exactly at the boundary, not a second later", () => {
    const cooldown = deriveElecCooldown(NOW - BigInt(ELEC_COOLDOWN_SECONDS), NOW);

    expect(cooldown.remainingSeconds).toBe(0);
    expect(cooldown.canPay).toBe(true);
  });

  it("clamps at zero long after the window elapsed, never going negative", () => {
    const cooldown = deriveElecCooldown(
      NOW - BigInt(ELEC_COOLDOWN_SECONDS) * 4n,
      NOW,
    );

    expect(cooldown.remainingSeconds).toBe(0);
    expect(cooldown.canPay).toBe(true);
    expect(cooldown.neverPaid).toBe(false);
  });

  it("flags a future timestamp as a clock anomaly and caps the remainder", () => {
    // A payment stamped in the future means the chain clock, the server clock or
    // the decode disagree. The countdown must stay bounded AND say so.
    const cooldown = deriveElecCooldown(
      NOW + BigInt(ELEC_COOLDOWN_SECONDS) * 10n,
      NOW,
    );

    expect(cooldown.clockAnomaly).toBe(true);
    expect(cooldown.remainingSeconds).toBe(ELEC_COOLDOWN_SECONDS);
    expect(cooldown.canPay).toBe(false);
  });

  it("always states the window it used", () => {
    expect(deriveElecCooldown(NOW, NOW).cooldownDays).toBe(ELEC_COOLDOWN_DAYS);
    expect(deriveElecCooldown(0n, NOW).cooldownDays).toBe(ELEC_COOLDOWN_DAYS);
    expect(ELEC_COOLDOWN_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
