#!/usr/bin/env node
// Libère le port de dev (4105) avant que `next dev` ne démarre.
// Branché sur le hook `predev` de package.json → s'exécute automatiquement
// à chaque `pnpm dev`, ce qui évite l'empilement de serveurs Next zombies
// sur le même port (cause de conflits aléatoires en HMR).
//
// Cross-platform : lsof sur macOS/Linux. No-op silencieux si rien n'écoute.

import { execSync } from "node:child_process";

const PORT = process.env.PORT ?? "4105";

function pidsOnPort(port) {
  try {
    // -t : PIDs seuls ; -i : par port. Échoue (code 1) si aucun listener → []
    const out = execSync(`lsof -ti tcp:${port}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

const pids = pidsOnPort(PORT);
if (pids.length === 0) {
  console.log(`[free-port] port ${PORT} déjà libre`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    process.kill(Number(pid), "SIGKILL");
    console.log(`[free-port] killed PID ${pid} sur le port ${PORT}`);
  } catch {
    // Process déjà mort ou non killable — on ignore.
  }
}

// Vérifier que le port est réellement libéré (zombie UE macOS peut rester LISTEN).
const stillBusy = pidsOnPort(PORT);
if (stillBusy.length > 0) {
  console.error(
    `[free-port] ERREUR: le port ${PORT} reste occupé par PID ${stillBusy.join(", ")} ` +
      `(souvent un next-server zombie stat=UE). kill -9 ne suffit pas.`,
  );
  console.error(
    `[free-port] → Redémarre le Mac, ou lance en attendant:\n` +
      `   NODE_OPTIONS=--max-http-header-size=65536 pnpm exec next dev -p 4106`,
  );
  process.exit(1);
}
