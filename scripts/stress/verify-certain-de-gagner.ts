// Isolated reproduction of the "certain de gagner" finding against REAL prod source.
// forbidden-words.ts is a pure module (no @/ imports) so we import it by relative path.
// output-guard.ts imports @/lib/agents/* so we re-implement the one-line delegation
// it does (chatOutputViolation -> containsForbiddenChat) to test the same path
// without needing the @ alias.
//
// Run: pnpm exec tsx scripts/stress/verify-certain-de-gagner.ts

import {
  containsForbiddenChat,
  CHAT_FORBIDDEN_WORDS,
} from "../../src/lib/agents/forbidden-words.ts";

const probes = [
  "certain de gagner",
  "vous êtes certain de gagner",
  "c'est un rendement certain", // the multi-word needle that DOES exist
  "sûr de gagner",
  "garanti", // sanity: known-caught
];

console.log("CHAT_FORBIDDEN_WORDS =", JSON.stringify([...CHAT_FORBIDDEN_WORDS]));
console.log("bare 'certain' present? ", CHAT_FORBIDDEN_WORDS.includes("certain" as never));
console.log("---");
for (const p of probes) {
  const r = containsForbiddenChat(p);
  console.log(`${JSON.stringify(p).padEnd(40)} -> ${r ? "BLOCKED " + JSON.stringify(r.found) : "PASSED (null)"}`);
}
