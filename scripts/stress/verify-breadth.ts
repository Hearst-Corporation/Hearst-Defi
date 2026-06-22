import { containsForbiddenChat } from "../../src/lib/agents/forbidden-words.ts";

// Realistic FR LP-chat certainty claims that SHOULD be non-compliant per #5.
const claims = [
  "Vous êtes certain de gagner avec ce coffre.",
  "Vous êtes sûr de gagner.",
  "Vous êtes certain de doubler votre capital.",
  "Le gain est certain à 100%.", // "gain certain" needle present -> should block
  "Avec Hearst, gagner est certain.",
];

// Legitimate FR uses of "certains/certaine" that SHOULD pass (the false-positive
// the exclusion is protecting against).
const benign = [
  "Certains investisseurs préfèrent un ticket plus élevé.",
  "Une certaine volatilité reste possible.",
];

console.log("== certainty CLAIMS (expected BLOCKED per #5) ==");
for (const c of claims) {
  const r = containsForbiddenChat(c);
  console.log((r ? "BLOCKED" : "PASSED ").padEnd(8), JSON.stringify(c));
}
console.log("\n== benign 'certains/certaine' (expected PASSED) ==");
for (const b of benign) {
  const r = containsForbiddenChat(b);
  console.log((r ? "BLOCKED" : "PASSED ").padEnd(8), JSON.stringify(b));
}
