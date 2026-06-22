import {
  containsForbidden,
  containsForbiddenChat,
} from "../../src/lib/agents/forbidden-words.ts";

for (const p of ["certain to win", "you are certain to win", "certain de gagner"]) {
  console.log(
    JSON.stringify(p).padEnd(28),
    "EN(agents):",
    containsForbidden(p) ? "BLOCKED" : "passed",
    "| CHAT:",
    containsForbiddenChat(p) ? "BLOCKED" : "passed",
  );
}
