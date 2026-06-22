// Adversarial repro: extract the 3 cited regexes verbatim from the source file
// and test the conversational phrases. No imports of the TS module (avoids
// transpile) — we hard-copy the regex literals from nav-fallback-intent.ts.

const PROOF_CENTER = /\b(proof\s*center|preuve de r[eé]serve|attestations?|r[eé]serves on-?chain)\b/i;
const ADMIN_OUTREACH = /\b(outreach|email de prospection|envoyer un email|compose email|campagne email|prospection)\b/i;
const ADMIN_SCENARIO = /\b(simuler|simulation|scenario|scénario|stress test|stress-test|monte carlo|backtest|run scenario)\b/i;

const cases = [
  // [phrase, regex, label]
  ["peux-tu m'expliquer la preuve de réserve", PROOF_CENTER, "proof-center (corpus FP)"],
  ["what is our outreach strategy", ADMIN_OUTREACH, "admin-outreach"],
  ["explique-moi ce scénario de stress", ADMIN_SCENARIO, "admin-scenario-lab"],
  ["what does the monte carlo simulation show", ADMIN_SCENARIO, "admin-scenario-lab"],
  ["je ne comprends pas la simulation", ADMIN_SCENARIO, "admin-scenario-lab"],
  // Control: a NAV-verb-gated derived term should NOT be in these literals
  ["je ne comprends pas mes distributions", /\b(distributions)\b/i, "control (derived term)"],
];

for (const [phrase, re, label] of cases) {
  const hit = re.test(phrase.trim());
  console.log(`${hit ? "MATCH " : "no    "} | ${label.padEnd(28)} | "${phrase}"`);
}
