#!/usr/bin/env node
/**
 * scripts/agentic/calibrate-swarms.mjs
 *
 * Non-destructive LIVE calibration of the agentic swarm chain against a running
 * admin server. Read + simulation only:
 *   - GET  /api/admin/agentic/registry
 *   - POST /api/admin/agentic/simulate           (sideEffects:false, no real exec)
 *   - GET  /api/admin/agentic/simulations         (metadata-only)
 *   - GET  /api/admin/agentic/simulations/aggregates
 *
 * It performs NO DB write, NO external tool call, NO business mutation. Trace
 * recording is OFF by default (read-only); pass --record to exercise the opt-in
 * observability path (which only writes metadata-only traces to the capped store).
 *
 * Usage:
 *   BASE_URL=http://localhost:4105 node scripts/agentic/calibrate-swarms.mjs
 *   node scripts/agentic/calibrate-swarms.mjs --record
 *
 * Exit 0 = all safety invariants held. Exit 1 = a swarm/action behaved unsafely.
 * Exit 2 = could not reach the server (not a pass).
 */

const BASE = (process.env.BASE_URL || "http://localhost:4105").replace(/\/$/, "");
const API = `${BASE}/api/admin/agentic`;
const RECORD = process.argv.includes("--record");

const FORBIDDEN_ACTION = "deploy_product";
const CONFIRMED_ACTION = "outreach_trigger_send_run";
const DRAFT_ACTION = "create_vault_draft";
const READ_ACTION = "read_observability";
const UNKNOWN_ACTION = "send_money_to_attacker";
const UNKNOWN_SWARM = "definitely_not_a_swarm";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = !!cond;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function simulate(body) {
  const res = await fetch(`${API}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  // 0) reachability
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    await fetch(`${BASE}/login`, { redirect: "manual", signal: ctrl.signal });
    clearTimeout(t);
  } catch {
    console.error(`Cannot reach ${BASE} — start the server first.`);
    process.exit(2);
  }

  // 1) registry
  const reg = await getJson("/registry");
  if (reg.status !== 200 || !reg.json?.snapshot) {
    console.error(`registry not available (HTTP ${reg.status}) — admin auth required?`);
    process.exit(2);
  }
  const snap = reg.json.snapshot;
  const swarms = snap.swarms ?? [];
  check("registry has swarms", swarms.length > 0, `${swarms.length} swarms`);
  check(
    "no swarm uses autonomous_write",
    swarms.every((s) => ["simulation", "dry_run", "gated"].includes(s.mode)),
  );
  check("registry sideEffects false", reg.json.sideEffects === false);

  // 2) per-swarm safety matrix
  for (const s of swarms) {
    const sw = s.id;
    const scoped = Array.isArray(s.allowedActionIds); // enforcing swarm
    const base = await simulate({ swarmId: sw });
    check(`${sw}: valid simulate 200`, base.status === 200);
    check(`${sw}: sideEffects false`, base.json?.sideEffects === false);

    // Universal floor — holds for EVERY swarm regardless of scope.
    const fb = await simulate({
      swarmId: sw,
      actionId: FORBIDDEN_ACTION,
      context: { hasHumanConfirmationToken: true },
    });
    check(
      `${sw}: forbidden_autonomous blocked WITH token`,
      fb.json?.readiness?.decision === "blocked",
      fb.json?.readiness?.reasonCode,
    );
    const uk = await simulate({ swarmId: sw, actionId: UNKNOWN_ACTION });
    check(
      `${sw}: unknown action blocked fail-safe`,
      uk.json?.readiness?.decision === "blocked" && uk.json?.readiness?.unknown === true,
    );
    check(
      `${sw}: no prompt/user-text/raw leak`,
      !/"(prompt|userText|rawBody|cookie|secret)"/i.test(JSON.stringify(base.json)),
    );

    if (scoped) {
      // ENFORCING swarm: out-of-scope blocked, in-scope reachable, swarm-forbidden blocked.
      const inScope = s.allowedActionIds[0];
      const isc = await simulate({ swarmId: sw, actionId: inScope });
      check(
        `${sw}: in-scope action reachable (${inScope})`,
        isc.json?.readiness?.reasonCode !== "action_out_of_swarm_scope",
      );
      if (!s.allowedActionIds.includes(READ_ACTION)) {
        const oos = await simulate({ swarmId: sw, actionId: READ_ACTION });
        check(
          `${sw}: out-of-scope action blocked (action_out_of_swarm_scope)`,
          oos.json?.readiness?.decision === "blocked" &&
            oos.json?.readiness?.reasonCode === "action_out_of_swarm_scope",
        );
      }
      const fbAction = s.forbiddenActions[0];
      if (fbAction) {
        const fbs = await simulate({ swarmId: sw, actionId: fbAction });
        check(
          `${sw}: swarm-forbidden action blocked (${fbAction})`,
          fbs.json?.readiness?.decision === "blocked",
          fbs.json?.readiness?.reasonCode,
        );
      }
    } else {
      // TIER-ONLY swarm: backward-compatible behaviour.
      const cw = await simulate({ swarmId: sw, actionId: CONFIRMED_ACTION });
      check(
        `${sw}: confirmed_write needs human (no token)`,
        cw.json?.readiness?.decision === "requires_human_confirmation",
      );
      const dr = await simulate({ swarmId: sw, actionId: DRAFT_ACTION });
      check(`${sw}: draft is gated`, dr.json?.readiness?.decision === "gated");
      const ro = await simulate({ swarmId: sw, actionId: READ_ACTION });
      check(`${sw}: read_only allowed`, ro.json?.readiness?.decision === "allow");
    }

    if (RECORD) {
      const rec = await simulate({ swarmId: sw, observability: { record: true } });
      check(
        `${sw}: opt-in record metadata-only`,
        rec.json?.observability?.requested === true &&
          rec.json?.observability?.recorded === true,
      );
    }
  }

  // 3) unknown swarm -> 404
  const us = await simulate({ swarmId: UNKNOWN_SWARM });
  check("unknown swarm -> 404", us.status === 404);

  // 4) aggregates
  const agg = await getJson("/simulations/aggregates?window=all");
  check("aggregates available", agg.json?.available === true);
  check("aggregates metadataOnly", agg.json?.aggregates?.metadataOnly === true);
  check(
    "aggregates no raw body leak",
    !/"id"|createdAt|prompt|userText/.test(JSON.stringify(agg.json)),
  );
  const clamp = await getJson("/simulations/aggregates?limit=999");
  check("aggregates limit clamp 200", clamp.status === 200);
  const bad = await getJson("/simulations/aggregates?window=9001y");
  check("aggregates invalid window -> 400", bad.status === 400);

  console.log("");
  if (failures > 0) {
    console.log(`CALIBRATION FAILED — ${failures} unsafe/incorrect behaviour(s)`);
    process.exit(1);
  }
  console.log("CALIBRATION OK — all swarm safety invariants held");
  process.exit(0);
}

main().catch((err) => {
  console.error(`calibration error: ${err?.message || err}`);
  process.exit(2);
});
