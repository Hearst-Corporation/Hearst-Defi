#!/usr/bin/env node
/**
 * qa-network-guardrails.mjs
 *
 * Non-UI performance guardrail for duplicate client-side network calls.
 *
 * WHY THIS EXISTS
 * ---------------
 * A regression was observed where loading `/portfolio` fired:
 *   - `/api/chat-nav`            → 7 times on a single initial load (should be ≤ 1)
 *   - `/api/admin/review-mode`   → on `/portfolio`, a non-admin route (should be 0)
 * SSR itself was fast (TTFB ~89ms, FCP ~132ms, ~466 DOM nodes, 0 long tasks), so the
 * cost was purely client-side network churn. This script loads `/portfolio` in a real
 * headless browser, counts API calls per endpoint, and FAILS (exit 1) if the guardrails
 * are breached. It also reports TTFB / FCP / DOMContentLoaded / long tasks / DOM nodes
 * as INFO so the same regression surface is observable.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * - It does not change any application code, UI, design system, router, guard, HITL, or
 *   chat behaviour. It is a read-only observer.
 * - It does not "fix" the calls. If the application fix is not merged yet, this script
 *   reports the failure honestly — it never masks or fabricates a passing result.
 *
 * USAGE
 * -----
 *   pnpm qa:perf-network                 # against http://localhost:4105 (default)
 *   BASE_URL=http://localhost:4105 node scripts/perf/qa-network-guardrails.mjs
 *
 * Optional env:
 *   BASE_URL                base URL of a running dev/preview server (default :4105)
 *   QA_ROUTE                route to probe (default /portfolio)
 *   QA_EMAIL / QA_PASSWORD  seeded login creds (default test@hearst.local / TestPassword123!)
 *   QA_SETTLE_MS            extra settle time after load to catch polling bursts (default 4000)
 *   QA_MAX_CHAT_NAV         max allowed /api/chat-nav calls (default 1)
 *   QA_MAX_REVIEW_MODE      max allowed /api/admin/review-mode calls on the route (default 0)
 *   QA_REQUIRE_LONGTASKS_0  "1" to FAIL on long tasks, else WARN only (default warn)
 *
 * EXIT CODES
 * ----------
 *   0  all hard guardrails passed
 *   1  a hard guardrail failed (too many calls), OR a forbidden call appeared
 *   2  could not run the check (server down, login blocked, browser missing) — NOT a pass
 */

const BASE_URL = (process.env.BASE_URL || "http://localhost:4105").replace(/\/$/, "");
const ROUTE = process.env.QA_ROUTE || "/portfolio";
const EMAIL = process.env.QA_EMAIL || "test@hearst.local";
const PASSWORD = process.env.QA_PASSWORD || "TestPassword123!";
const SETTLE_MS = Number(process.env.QA_SETTLE_MS || 4000);
const MAX_CHAT_NAV = Number(process.env.QA_MAX_CHAT_NAV || 1);
const MAX_REVIEW_MODE = Number(process.env.QA_MAX_REVIEW_MODE || 0);
const REQUIRE_LONGTASKS_0 = process.env.QA_REQUIRE_LONGTASKS_0 === "1";

// Endpoints we guard. `match` is tested against the request URL pathname.
const CHAT_NAV_RE = /^\/api\/chat-nav(\/|$|\?)/;
const REVIEW_MODE_RE = /^\/api\/admin\/review-mode(\/|$|\?)/;

function color(s, c) {
  const codes = { red: 31, green: 32, yellow: 33, dim: 2, bold: 1 };
  return process.stdout.isTTY ? `[${codes[c]}m${s}[0m` : s;
}
const PASS = () => color("PASS", "green");
const FAIL = () => color("FAIL", "red");
const WARN = () => color("WARN", "yellow");
const INFO = () => color("INFO", "dim");

function exitSkip(reason) {
  console.log("");
  console.log(color("PERF NETWORK QA — could not run (not a pass)", "yellow"));
  console.log(`reason: ${reason}`);
  console.log(
    "Start the app first (e.g. `pnpm dev`) and/or seed a test user (`pnpm seed:test`), " +
      "then re-run `pnpm qa:perf-network`.",
  );
  process.exit(2);
}

async function loadChromium() {
  try {
    const mod = await import("@playwright/test");
    if (mod.chromium) return mod.chromium;
  } catch {
    /* fall through */
  }
  try {
    const mod = await import("playwright");
    if (mod.chromium) return mod.chromium;
  } catch {
    /* fall through */
  }
  return null;
}

async function serverUp() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(BASE_URL + "/login", {
      redirect: "manual",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.status > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log(color(`PERF NETWORK QA — ${ROUTE}`, "bold"));
  console.log(color(`base: ${BASE_URL}`, "dim"));

  if (!(await serverUp())) {
    exitSkip(`no server reachable at ${BASE_URL}`);
  }

  const chromium = await loadChromium();
  if (!chromium) {
    exitSkip(
      "Playwright chromium not available (run `pnpm exec playwright install chromium`)",
    );
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    exitSkip(`could not launch chromium: ${err?.message || err}`);
  }

  const context = await browser.newContext();

  // Collect long tasks from the very first script execution onward.
  await context.addInitScript(() => {
    // eslint-disable-next-line no-undef
    window.__qaLongTasks = 0;
    try {
      // eslint-disable-next-line no-undef
      const obs = new PerformanceObserver((list) => {
        // eslint-disable-next-line no-undef
        window.__qaLongTasks += list.getEntries().length;
      });
      obs.observe({ entryTypes: ["longtask"] });
      // eslint-disable-next-line no-undef
      window.__qaLongTaskSupported = true;
    } catch {
      // eslint-disable-next-line no-undef
      window.__qaLongTaskSupported = false;
    }
  });

  const page = await context.newPage();

  // Count every request by pathname. We track the guarded endpoints plus a
  // generic per-endpoint tally for the report.
  const calls = { chatNav: [], reviewMode: [] };
  const perEndpoint = new Map();

  page.on("request", (req) => {
    let pathname;
    try {
      pathname = new URL(req.url()).pathname;
    } catch {
      return;
    }
    if (!pathname.startsWith("/api/")) return;
    perEndpoint.set(pathname, (perEndpoint.get(pathname) || 0) + 1);
    if (CHAT_NAV_RE.test(pathname)) calls.chatNav.push(req.url());
    if (REVIEW_MODE_RE.test(pathname)) calls.reviewMode.push(req.url());
  });

  // Best-effort login through the real form so /portfolio is reachable. If the
  // route turns out to be public this is a harmless no-op.
  let authNote = "";
  try {
    await page.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded", timeout: 20000 });
    const emailField = page.getByLabel(/^email$/i);
    if (await emailField.count()) {
      await emailField.fill(EMAIL);
      await page.getByLabel(/^password$/i).fill(PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page
        .waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 })
        .catch(() => {});
    }
  } catch (err) {
    authNote = `login step skipped: ${err?.message || err}`;
  }

  // Reset counters AFTER auth so the login round-trip never pollutes the
  // /portfolio measurement.
  calls.chatNav.length = 0;
  calls.reviewMode.length = 0;
  perEndpoint.clear();

  // The actual measured navigation.
  let landedPath = ROUTE;
  try {
    await page.goto(BASE_URL + ROUTE, { waitUntil: "load", timeout: 30000 });
    landedPath = new URL(page.url()).pathname;
  } catch (err) {
    await browser.close();
    exitSkip(`navigation to ${ROUTE} failed: ${err?.message || err}`);
  }

  if (landedPath.startsWith("/login")) {
    await browser.close();
    exitSkip(
      `redirected to ${landedPath} — auth required and seeded login did not take. ` +
        `Run \`pnpm seed:test\` and ensure the app allows form login.`,
    );
  }

  // Let client polling / lazy probes fire. The chat-nav regression was a burst
  // that only shows up a few seconds after load, so we wait for network to go
  // idle and then hold for the configured settle window.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(SETTLE_MS);

  // Perf metrics (best-effort — fields may be unavailable across environments).
  const metrics = await page.evaluate(() => {
    // eslint-disable-next-line no-undef
    const nav = performance.getEntriesByType("navigation")[0];
    // eslint-disable-next-line no-undef
    const fcpEntry = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
    return {
      // eslint-disable-next-line no-undef
      ttfb: nav ? Math.round(nav.responseStart) : null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      fcp: fcpEntry ? Math.round(fcpEntry.startTime) : null,
      // eslint-disable-next-line no-undef
      domNodes: document.getElementsByTagName("*").length,
      // eslint-disable-next-line no-undef
      longTasks: typeof window.__qaLongTasks === "number" ? window.__qaLongTasks : null,
      // eslint-disable-next-line no-undef
      longTaskSupported: window.__qaLongTaskSupported === true,
    };
  });

  await browser.close();

  // ---- Evaluate guardrails -------------------------------------------------
  const chatNavCount = calls.chatNav.length;
  const reviewModeCount = calls.reviewMode.length;
  const isAdminRoute = landedPath.startsWith("/admin");

  const results = [];

  results.push({
    hard: true,
    pass: chatNavCount <= MAX_CHAT_NAV,
    line: `chat-nav calls: ${chatNavCount} (max ${MAX_CHAT_NAV})`,
  });

  // review-mode is only allowed on explicitly admin/review routes.
  if (isAdminRoute) {
    results.push({
      hard: false,
      pass: true,
      info: true,
      line: `admin review-mode calls: ${reviewModeCount} (admin route — not guarded)`,
    });
  } else {
    results.push({
      hard: true,
      pass: reviewModeCount <= MAX_REVIEW_MODE,
      line: `admin review-mode calls: ${reviewModeCount} (max ${MAX_REVIEW_MODE} on non-admin ${landedPath})`,
    });
  }

  // Long tasks: hard only if explicitly required, else informational/warn.
  if (metrics.longTasks === null || !metrics.longTaskSupported) {
    results.push({
      hard: false,
      warn: true,
      line: `long tasks: unavailable (PerformanceObserver longtask unsupported in this env)`,
    });
  } else if (REQUIRE_LONGTASKS_0) {
    results.push({
      hard: true,
      pass: metrics.longTasks === 0,
      line: `long tasks: ${metrics.longTasks} (required 0)`,
    });
  } else {
    results.push({
      hard: false,
      warn: metrics.longTasks > 0,
      pass: metrics.longTasks === 0,
      line: `long tasks: ${metrics.longTasks}`,
    });
  }

  // ---- Report --------------------------------------------------------------
  console.log("");
  console.log(color(`PERF NETWORK QA — ${landedPath}`, "bold"));
  for (const r of results) {
    let tag;
    if (r.info) tag = INFO();
    else if (r.hard) tag = r.pass ? PASS() : FAIL();
    else if (r.warn) tag = WARN();
    else tag = r.pass ? PASS() : WARN();
    console.log(`${r.line} ${tag}`);
  }

  // INFO metrics
  const fmt = (v, unit = "") => (v === null || v === undefined ? "n/a" : `${v}${unit}`);
  console.log(`dom nodes: ${fmt(metrics.domNodes)} ${INFO()}`);
  console.log(`fcp: ${fmt(metrics.fcp, "ms")} ${INFO()}`);
  console.log(`ttfb: ${fmt(metrics.ttfb, "ms")} ${INFO()}`);
  console.log(`domContentLoaded: ${fmt(metrics.domContentLoaded, "ms")} ${INFO()}`);
  if (authNote) console.log(color(authNote, "dim"));

  // Per-endpoint breakdown (helps diagnose which polling loop misbehaves).
  if (perEndpoint.size) {
    console.log("");
    console.log(color("per-endpoint API call counts:", "dim"));
    for (const [path, n] of [...perEndpoint.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(color(`  ${n.toString().padStart(3)}  ${path}`, "dim"));
    }
  }

  const hardFailures = results.filter((r) => r.hard && !r.pass);
  console.log("");
  if (hardFailures.length) {
    console.log(color(`FAILED — ${hardFailures.length} guardrail(s) breached`, "red"));
    process.exit(1);
  }
  console.log(color("OK — all network guardrails passed", "green"));
  process.exit(0);
}

main().catch((err) => {
  exitSkip(`unexpected error: ${err?.stack || err?.message || err}`);
});
