#!/usr/bin/env node
/**
 * Runtime coherence validator for the Zandbank demo account.
 *
 * Scope:
 * - source-of-truth constants (allowlist + fixture source files)
 * - local demo data in SQLite (prisma/dev.db), read-only
 * - reachable local HTTP routes (/api/health*, product entry routes)
 *
 * No writes, no migrations, no secret reads.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";

const ROOT = process.cwd();
const DB_PATH = resolve(ROOT, "prisma/dev.db");
const ALLOWLIST_PATH = resolve(ROOT, "src/lib/demo/allowlist.ts");
const FIXTURE_PATH = resolve(ROOT, "src/lib/demo/zand-fixture.ts");
const BASE_URL = process.env.ZANDBANK_VALIDATE_BASE_URL ?? "http://localhost:4105";
const STRICT = process.env.ZANDBANK_VALIDATE_STRICT === "1";

const ZAND_EMAIL = "zand.demo@hearstcorporation.io";
const EXPECTED_TXHASH =
  "0xZANDDEMOSEED0000000000000000000000000000000000000000000000000000";
const ALLOWED_POSITION_STATUS = new Set(["active", "matured", "exited"]);
// SERIES 1 (mining note v3.0): the Zand demo accumulates BTC and delivers at
// maturity — it NEVER distributes cash periodically. `distribution` is no
// longer a valid transaction type for this demo account; a distribution row
// here is a regression to the retired yield-vault model.
const ALLOWED_TX_TYPES = new Set(["deposit", "claim", "withdraw"]);

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function softFail(msg) {
  if (STRICT) {
    fail(msg);
  } else {
    warn(msg);
  }
}

function ok(label, msg) {
  console.log(`[ok] ${label}: ${msg}`);
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function asDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function checkSourceOfTruth() {
  if (!existsSync(ALLOWLIST_PATH)) {
    fail("Missing src/lib/demo/allowlist.ts");
    return;
  }
  if (!existsSync(FIXTURE_PATH)) {
    fail("Missing src/lib/demo/zand-fixture.ts");
    return;
  }

  const allowlist = readFileSync(ALLOWLIST_PATH, "utf8");
  const fixture = readFileSync(FIXTURE_PATH, "utf8");

  const allowlistHits = (allowlist.match(/zand\.demo@hearstcorporation\.io/gi) ?? []).length;
  if (allowlistHits < 1) {
    fail("Zand email is not present in demo allowlist");
  } else {
    ok("identity", "Zand email is allowlisted");
  }

  if (!fixture.includes("ZAND_FIXTURE_EMAIL")) {
    fail("zand-fixture.ts does not export ZAND_FIXTURE_EMAIL");
  } else {
    ok("fixture", "Zand fixture module exports account constants");
  }

  if (!fixture.includes(EXPECTED_TXHASH)) {
    fail("zand-fixture.ts missing expected seed tx hash marker");
  } else {
    ok("fixture", "Seed tx hash marker is defined");
  }

  // SERIES 1 narrative markers — the retired yield/APY/monthly-distribution
  // model must be gone, and the BTC-accumulation constants must be present.
  if (/MONTHLY_DISTRIBUTIONS/.test(fixture)) {
    fail(
      "zand-fixture.ts still exports a MONTHLY_DISTRIBUTIONS constant (retired yield-vault model)",
    );
  } else {
    ok("fixture", "no legacy monthly-distribution schedule");
  }

  if (!fixture.includes("ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC")) {
    fail("zand-fixture.ts does not expose the BTC-accumulation constant (SERIES 1)");
  } else {
    ok("fixture", "SERIES 1 BTC-accumulation constant is defined");
  }

  if (!fixture.includes("ZAND_FIXTURE_POCKET_SPLIT")) {
    fail("zand-fixture.ts does not expose the B1/B2/B3 pocket split (SERIES 1)");
  } else {
    ok("fixture", "SERIES 1 pocket split (B1/B2/B3 40/27/33) is defined");
  }
}

function checkDatabase() {
  if (!existsSync(DB_PATH)) {
    softFail("Local sqlite DB not found at prisma/dev.db");
    return;
  }

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  try {
    const user = db
      .prepare(
        `
          SELECT id, email, role
          FROM "User"
          WHERE lower(trim(email)) = lower(trim(?))
          LIMIT 1
        `,
      )
      .get(ZAND_EMAIL);

    if (!user) {
      softFail(
        "Zand demo user not found in local DB (bootstrap local demo data, e.g. pnpm seed:zandbank-demo:local, with a non-prod DATABASE_URL).",
      );
      return;
    }
    ok("account", `user found (${user.id})`);

    const investor = db
      .prepare(
        `
          SELECT id, userId, email, kycStatus
          FROM "Investor"
          WHERE userId = ?
          LIMIT 1
        `,
      )
      .get(user.id);

    if (!investor) {
      softFail("Zand user exists but has no Investor profile");
      return;
    }
    ok("account", `investor profile found (${investor.id})`);

    const positions = db
      .prepare(
        `
          SELECT id, status, principalUsdc, accruedYieldUsdc, distributedUsdc, subscribedAt, vaultDeploymentId, vaultKey
          FROM "Position"
          WHERE investorId = ?
          ORDER BY subscribedAt ASC
        `,
      )
      .all(investor.id);

    const txs = db
      .prepare(
        `
          SELECT id, positionId, type, amountUsdc, txHash, occurredAt
          FROM "InvestorTransaction"
          WHERE investorId = ?
          ORDER BY occurredAt ASC
        `,
      )
      .all(investor.id);

    const nav = db
      .prepare(
        `
          SELECT id, takenAt, valueUsdc
          FROM "InvestorNavSnapshot"
          WHERE investorId = ?
          ORDER BY takenAt ASC
        `,
      )
      .all(investor.id);

    const positionIds = new Set();
    let principalSum = 0;
    let accruedSum = 0;
    let distributedPosSum = 0;

    for (const p of positions) {
      if (positionIds.has(p.id)) fail(`Duplicate position id: ${p.id}`);
      positionIds.add(p.id);

      if (!ALLOWED_POSITION_STATUS.has(p.status)) {
        fail(`Invalid position status on ${p.id}: ${String(p.status)}`);
      }
      const subscribedAt = asDate(p.subscribedAt);
      if (!subscribedAt) fail(`Invalid subscribedAt on position ${p.id}`);

      const principal = Number(p.principalUsdc);
      const accrued = Number(p.accruedYieldUsdc);
      const distributed = Number(p.distributedUsdc);

      if (!isFiniteNumber(principal) || principal < 0) {
        fail(`Invalid principalUsdc on position ${p.id}: ${String(p.principalUsdc)}`);
      }
      if (!isFiniteNumber(accrued)) {
        fail(`Invalid accruedYieldUsdc on position ${p.id}: ${String(p.accruedYieldUsdc)}`);
      }
      if (!isFiniteNumber(distributed) || distributed < 0) {
        fail(`Invalid distributedUsdc on position ${p.id}: ${String(p.distributedUsdc)}`);
      }

      principalSum += principal;
      accruedSum += accrued;
      distributedPosSum += distributed;
    }

    const txIds = new Set();
    const txHashes = new Set();
    let distributionsTxSum = 0;
    let depositsTxSum = 0;
    let seededDepositMarkerCount = 0;

    for (const tx of txs) {
      if (txIds.has(tx.id)) fail(`Duplicate transaction id: ${tx.id}`);
      txIds.add(tx.id);

      if (!ALLOWED_TX_TYPES.has(tx.type)) {
        fail(`Invalid transaction type on ${tx.id}: ${String(tx.type)}`);
      }
      const occurredAt = asDate(tx.occurredAt);
      if (!occurredAt) fail(`Invalid occurredAt on transaction ${tx.id}`);

      const amount = Number(tx.amountUsdc);
      if (!isFiniteNumber(amount)) {
        fail(`Invalid amountUsdc on transaction ${tx.id}: ${String(tx.amountUsdc)}`);
      }
      if (amount < 0) {
        fail(`Negative amountUsdc on transaction ${tx.id}`);
      }

      if (tx.positionId && !positionIds.has(tx.positionId)) {
        fail(`Transaction ${tx.id} references missing position ${tx.positionId}`);
      }

      if (tx.txHash) {
        if (txHashes.has(tx.txHash)) {
          fail(`Duplicate txHash detected: ${tx.txHash}`);
        }
        txHashes.add(tx.txHash);
      }
      if (tx.txHash === EXPECTED_TXHASH) seededDepositMarkerCount += 1;

      if (tx.type === "distribution") distributionsTxSum += amount;
      if (tx.type === "deposit") depositsTxSum += amount;
    }

    if (positions.length === 0) {
      warn("Zand investor has no positions in local DB (empty-state demo)");
    } else {
      ok("portfolio", `${positions.length} position(s), ${txs.length} transaction(s)`);
    }

    const totalPortfolioValue = principalSum + accruedSum;
    if (!isFiniteNumber(totalPortfolioValue) || totalPortfolioValue < 0) {
      fail("Total portfolio value is invalid");
    } else {
      ok(
        "balances",
        `principal=${principalSum.toFixed(2)} accrued=${accruedSum.toFixed(2)} total=${totalPortfolioValue.toFixed(2)}`,
      );
    }

    if (Math.abs(distributedPosSum - distributionsTxSum) > 0.01) {
      fail(
        `distributed mismatch: positions=${distributedPosSum.toFixed(2)} vs tx=${distributionsTxSum.toFixed(2)}`,
      );
    } else {
      ok("accumulation", `distributed sums reconcile (${distributedPosSum.toFixed(2)})`);
    }

    // SERIES 1 (mining note v3.0): BTC is ACCUMULATED and delivered at maturity
    // — there is NO periodic cash distribution. Every distribution figure must
    // be exactly zero for the Zand demo. (Any `distribution` tx row would also
    // have already failed the ALLOWED_TX_TYPES check above.)
    if (distributionsTxSum !== 0 || distributedPosSum !== 0) {
      fail(
        `SERIES 1 must not distribute cash: distributedUsdc=${distributedPosSum.toFixed(2)} distributionTx=${distributionsTxSum.toFixed(2)} (expected 0/0 — BTC accumulated, delivered at maturity)`,
      );
    } else if (positions.length > 0) {
      ok(
        "accumulation",
        "0 distribution — BTC accumulated, delivered at maturity (no periodic cash, no APY)",
      );
    }

    // The accumulated BTC value is carried as capitalized accrued value on the
    // position (never distributed). When a funded SERIES 1 position exists it
    // should be a finite, non-negative Estimated figure.
    if (positions.length > 0 && accruedSum > 0) {
      ok(
        "accumulation",
        `accumulated BTC value (Estimated) = ${accruedSum.toFixed(2)} (capitalized, delivered at maturity)`,
      );
    }

    if (positions.length > 0 && depositsTxSum <= 0) {
      fail("Positions exist but no deposit transaction found");
    }
    if (depositsTxSum > 0 && principalSum <= 0) {
      fail("Deposit transactions exist but principal sum is zero");
    }
    if (depositsTxSum > 0 && Math.abs(depositsTxSum - principalSum) > 0.01) {
      warn(
        `deposit/principal mismatch (may be valid with lifecycle events): deposits=${depositsTxSum.toFixed(2)} principal=${principalSum.toFixed(2)}`,
      );
    }

    if (seededDepositMarkerCount > 1) {
      fail(`Seed marker txHash appears ${seededDepositMarkerCount} times (expected <=1)`);
    }
    if (seededDepositMarkerCount === 1) {
      ok("fixture", "seed marker txHash present exactly once");
    }

    // APY / vault checks for linked positions.
    for (const p of positions) {
      if (!p.vaultDeploymentId) continue;
      const vault = db
        .prepare(
          `
            SELECT id, status, targetApyLowBps, targetApyHighBps, targetMiningBps, targetBtcTacticalBps, targetUsdcBaseBps, targetStableReserveBps
            FROM "VaultDeployment"
            WHERE id = ?
            LIMIT 1
          `,
        )
        .get(p.vaultDeploymentId);
      if (!vault) {
        fail(`Position ${p.id} references missing vaultDeployment ${p.vaultDeploymentId}`);
        continue;
      }
      const apyLow = Number(vault.targetApyLowBps) / 100;
      const apyHigh = Number(vault.targetApyHighBps) / 100;
      if (!isFiniteNumber(apyLow) || !isFiniteNumber(apyHigh) || apyLow > apyHigh) {
        fail(`Invalid APY range on vault ${vault.id}: ${apyLow}..${apyHigh}`);
      }

      const allocSumBps =
        Number(vault.targetMiningBps) +
        Number(vault.targetBtcTacticalBps) +
        Number(vault.targetUsdcBaseBps) +
        Number(vault.targetStableReserveBps);
      if (allocSumBps !== 10_000) {
        warn(`Vault ${vault.id} allocation sum is ${allocSumBps} bps (expected 10000)`);
      }
    }

    // Latest snapshot allocations consistency (if present).
    const latestSnapshot = db
      .prepare(
        `
          SELECT id, takenAt, aumUsdc, currentApyLow, currentApyHigh
          FROM "VaultSnapshot"
          ORDER BY takenAt DESC
          LIMIT 1
        `,
      )
      .get();

    if (latestSnapshot) {
      const allocRows = db
        .prepare(
          `
            SELECT pct, valueUsdc
            FROM "VaultAllocationSnapshot"
            WHERE snapshotId = ?
          `,
        )
        .all(latestSnapshot.id);

      if (allocRows.length > 0) {
        const pctSum = allocRows.reduce((sum, r) => sum + Number(r.pct), 0);
        if (!isFiniteNumber(pctSum)) {
          fail("Snapshot allocation pct sum is NaN");
        } else if (Math.abs(pctSum - 100) > 0.25) {
          warn(`Latest snapshot allocation sum=${pctSum.toFixed(2)}% (expected ~100%)`);
        }
      }
    }

    for (const row of nav) {
      if (!asDate(row.takenAt)) fail(`Invalid NAV snapshot date ${row.id}`);
      const v = Number(row.valueUsdc);
      if (!isFiniteNumber(v)) fail(`Invalid NAV value ${row.id}`);
      if (v < 0) warn(`Negative NAV snapshot ${row.id} (${v})`);
    }
  } finally {
    db.close();
  }
}

async function checkHttp() {
  const publicApis = [
    { path: "/api/health", expectedStatus: 200 },
    { path: "/api/health/deep", expectedStatus: 200 },
  ];

  for (const route of publicApis) {
    const url = `${BASE_URL}${route.path}`;
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status !== route.expectedStatus) {
        fail(`${route.path} returned ${res.status} (expected ${route.expectedStatus})`);
        continue;
      }
      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        fail(`${route.path} did not return a JSON object`);
      } else {
        const body = JSON.stringify(json);
        if (body.includes("NaN") || body.includes("undefined")) {
          fail(`${route.path} JSON contains NaN/undefined`);
        }
        ok("api", `${route.path} ${res.status}`);
      }
    } catch (err) {
      warn(`${route.path} unreachable on ${BASE_URL}: ${String(err)}`);
    }
  }

  const authGated = ["/portfolio", "/vaults", "/admin", "/dashboard"];
  for (const path of authGated) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { method: "GET", redirect: "manual" });
      if (![200, 307, 308].includes(res.status)) {
        fail(`${path} returned ${res.status} (expected 200/307/308)`);
      } else {
        ok("ui-route", `${path} ${res.status}`);
      }
    } catch (err) {
      warn(`${path} unreachable on ${BASE_URL}: ${String(err)}`);
    }
  }
}

async function main() {
  console.log("=== Zandbank Demo Coherence Validation ===");
  console.log(`workspace: ${ROOT}`);
  console.log(`baseUrl: ${BASE_URL}`);
  console.log(`strict: ${STRICT ? "on" : "off"}`);
  console.log("");

  await checkSourceOfTruth();
  checkDatabase();
  await checkHttp();

  console.log("");
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`- ${w}`);
  } else {
    console.log("Warnings: none");
  }

  console.log("");
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`- ${f}`);
    console.log("");
    console.log(`Result: FAIL (${failures.length} issue(s))`);
    process.exit(1);
  }

  console.log("Failures: none");
  console.log("");
  console.log("Result: PASS");
}

main().catch((err) => {
  console.error("Unexpected validator error:", err);
  process.exit(1);
});
