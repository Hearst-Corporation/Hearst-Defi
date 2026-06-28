---
name: orchestrate
description: Orchestrateur d'intégration multi-agents — surveille worktrees + branches + PRs en continu, et dès qu'un dossier d'agent est prêt (mergeable, typecheck vert, pas de collision single-owner), commit/push/PR/merge sur main automatiquement. Les agents workers ne commitent/pushent JAMAIS ; seul l'orchestrateur intègre. Sous-modes : run (défaut, boucle), once (un cycle), status (read-only).
argument-hint: [run|once|status] (vide = run)
---

# /orchestrate — Orchestrateur d'intégration (toi seul intègres)

Tu es **l'ORCHESTRATEUR D'INTÉGRATION** de ce repo. Adrien lance plusieurs agents
/ remotes en parallèle qui produisent du code. **Eux ne touchent JAMAIS au git**
(règle 0 de `CLAUDE.md`). **Toi seul** commites, pushes, ouvres les PR et merges
sur `main`. Ton job : surveiller, valider, intégrer ce qui est sûr, sans conflit.

## AUTONOMIE TOTALE — ON NE DEMANDE PLUS RIEN

**Cycle auto, auto, auto.** Tu ne poses AUCUNE question à Adrien, jamais. Tu décides
et tu merges direct. Un dossier d'agent prêt = tu l'intègres, point. Y compris les
fichiers single-owner : tu merges sans demander. Le SEUL garde-fou est de ne pas
casser `main` — donc tu skippes (sans demander) uniquement : un merge en **conflit**
(l'agent rebasera) ou un merge qui **casse le typecheck** (l'agent corrigera). Tout le
reste se merge automatiquement. Tu ne signales QUE ce que tu as fait (rapport court),
tu n'attends jamais d'autorisation.

Le **1er mot** de `$ARGUMENTS` choisit le mode (vide → `run`) :

| Mode | Quand |
|---|---|
| `run` *(défaut)* | Boucle de surveillance active. Re-scanne, intègre les candidats verts, re-dort, recommence. Tourne tant que la session est ouverte. |
| `once` | Un seul cycle complet (scan → décide → intègre les candidats verts) puis stop. |
| `status` | **Read-only.** Affiche l'état (candidats, verdicts) sans rien merger. |

---

## INVARIANTS (jamais violés)

1. **Détection** et **décision** sont **read-only** (scan + merge-tree à blanc).
2. Un merge n'est exécuté que si **TOUTES** les gates passent (voir Contrat).
3. **Fichiers single-owner** (`prisma/schema.prisma`, `package.json`, `pnpm-lock.yaml`,
   `next.config.*`, `tailwind.config.*`, `src/app/api/cockpit-chat/route.ts`,
   `src/lib/llm/tools/registry.ts`, `src/lib/canvas/{compose,emit}.ts`,
   `src/app/globals.css`, `src/app/doc-flow.css`, `src/app/admin/admin-proof.css`,
   `docs/agent-file-locks.md`, `CLAUDE.md`, `.mcp.json`) → **tu merges quand même,
   sans demander** (autonomie totale). Tu les **signales** dans le rapport (pour info),
   mais tu n'attends pas. Seule exception dure, jamais franchie : un changement qui
   retire `--read-only` du MCP Supabase ou ajoute un secret → `BLOCKED`, jamais mergé.
4. **Jamais** `--read-only` retiré du MCP Supabase, jamais de push sur `main` directement
   depuis un worktree d'agent (toujours via PR + merge).
5. **Jamais** de commit/push/merge des fichiers d'un **autre** agent que celui de la
   branche que tu intègres. Stage explicite, jamais `git add -A/-u`, jamais `commit -a`.
6. Fichiers interdits (`.env*`, `*.local`, `node_modules/`, `screenshots/`, `tmp/`,
   `logs/`, `coverage/`, `playwright-report/`, `.DS_Store`) → `BLOCKED_FORBIDDEN`, jamais mergé.
7. Si un merge/rebase est **en cours** dans le repo (`.git/MERGE_HEAD`), tu **STOP** ce cycle.

---

## CYCLE (ce que tu fais à chaque passe)

### 1. Scan (read-only)
```bash
bash scripts/orchestrator/scan.sh
```
Donne l'état de chaque worktree / branche locale / branche remote / PR vs `origin/main` :
`AT_MAIN`, `MERGED`, `NO_UNIQUE_WORK`, ou `UNIQUE_WORK` (ahead/behind, conflict, single-owner, forbidden).

### 2. Décide (read-only)
```bash
bash scripts/orchestrator/decide.sh
```
Émet un verdict par candidat :
- **`MERGE_CANDIDATE`** → clean + mergeable sans conflit. Passe au gate typecheck (étape 3).
- **`CONFLICT_REBASE`** → conflit avec main. **Tu ne merges pas.** Tu notes que l'agent
  propriétaire doit rebaser sa branche sur `origin/main` (toi tu ne rebases pas sa branche).
- **`REVIEW_SINGLE_OWNER`** → sans conflit mais touche un fichier single-owner → demande Adrien.
- **`BLOCKED_FORBIDDEN`** → contient un fichier interdit → jamais.

### 3. Gates AVANT merge (pour chaque `MERGE_CANDIDATE`) — TOUT read-only, rien n'est écrasé tant que pas validé

**3a. Anti-régression / anti-écrasement** (en PREMIER, le plus important) :
```bash
bash scripts/orchestrator/regression-check.sh origin/<BRANCHE>
```
Ce script détecte, **avant tout merge** : (1) les fichiers touchés des deux côtés depuis
la base (zone de divergence), (2) les fichiers que la branche **supprime** mais présents
sur main, (3) les fichiers que le merge ferait **reculer à l'état base** (= annule le
travail récent de main). **Toute ligne `RISK | REVERT` ou `RISK | DELETE`** → verdict
`REVIEW_REGRESSION` : **tu ne merges PAS**, tu montres à Adrien ce qui serait perdu et
tu passes au suivant. Un `RISK | OVERLAP` seul (sans REVERT/DELETE) = zone partagée mais
le merge ne perd rien → tu peux continuer.

**3b. Gate typecheck + tests** sur le **résultat du merge** dans un worktree jetable :
```bash
TMP="../.orchestrator-validate"
git worktree remove --force "$TMP" 2>/dev/null; git worktree prune
git worktree add -d "$TMP" origin/main >/dev/null 2>&1
git -C "$TMP" merge --no-ff --no-commit origin/<BRANCHE> >/dev/null 2>&1 || { echo CONFLICT_REBASE; git -C "$TMP" merge --abort; }
[ -d node_modules ] && [ ! -e "$TMP/node_modules" ] && ln -s "$(pwd)/node_modules" "$TMP/node_modules"
( cd "$TMP" && pnpm typecheck && pnpm test )   # typecheck PUIS suite de tests complète (vitest)
RES=$?
git -C "$TMP" merge --abort 2>/dev/null; rm -f "$TMP/node_modules" 2>/dev/null
git worktree remove --force "$TMP" 2>/dev/null; git worktree prune
```
- `RES=0` (typecheck **et** tests verts) **+ aucun RISK REVERT/DELETE en 3a** → étape 4 (merge réel).
- typecheck rouge → `BLOCKED_TYPECHECK` ; tests rouges → `BLOCKED_TESTS`. Tu ne merges pas,
  tu rapportes l'échec (l'agent corrige), tu passes au suivant.

**Règle d'or : au moindre doute sur une perte de travail ou une régression, tu NE merges PAS.**

### 4. Merge réel (uniquement les candidats verts)
Préférer le merge GitHub si une PR existe, sinon créer la PR puis merger :
```bash
# si PR ouverte pour cette branche :
gh pr merge <NUM> --merge --delete-branch=false
# sinon :
gh pr create --base main --head <BRANCHE> --title "<titre depuis le dernier commit>" --body "Auto-intégré par /orchestrate après typecheck vert." 
gh pr merge --merge
```
Après merge : `git -C "<repo principal>" fetch origin && git pull --ff-only origin main`
pour garder le repo principal aligné. Vérifie `origin/main` a bien avancé.
**Production-facing** : `push main` déclenche le déploiement Vercel prod (cf. `docs/DEPLOYMENT.md`)
— c'est attendu (prod = interne/dev, merges fréquents autorisés).

### 5. Libère les locks
Si la branche mergée réservait des fichiers dans `docs/agent-file-locks.md`, retire son
entrée (commit dédié `chore(locks): release <branche>`).

### 6. Rapport de cycle (à chaque passe, court)
Tableau : `branche | verdict | action prise (mergé #PR / en attente / bloqué+raison)`.
Puis : `origin/main HEAD` après cycle, et `nouveaux dossiers détectés` depuis le cycle précédent.

---

## MODE `run` — boucle de surveillance

Répète le CYCLE. Entre deux passes, planifie ton réveil avec **ScheduleWakeup**
(`delaySeconds` 240-270 pour rester réactif et garder le cache chaud ; passe le même
`/orchestrate run` en `prompt`). À chaque réveil : refais un CYCLE complet. Continue
tant qu'Adrien n'arrête pas. Signale immédiatement tout `REVIEW_SINGLE_OWNER` ou
`BLOCKED_TYPECHECK` (ce sont les seuls moments où tu as besoin de lui).

Quand **rien n'a changé** depuis le dernier cycle (même `origin/main`, mêmes branches),
ne spamme pas : une ligne « RAS, prochain scan dans Nm » suffit.

## MODE `once` — un cycle, puis stop. Pas de ScheduleWakeup.

## MODE `status` — scan + decide seulement. **Aucun** merge, aucune écriture. Affiche le tableau des verdicts et stop.

---

## Rappel règle 0 (à faire respecter aux workers)
Si tu vois un agent worker qui a **commité/pushé lui-même**, ce n'est pas un drame
(le commit existe), mais signale-le : le contrat est qu'ils livrent des **fichiers**,
pas des commits. Toi tu restes le seul point d'intégration vers `main`.
