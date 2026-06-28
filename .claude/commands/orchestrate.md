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
3. **Jamais** de merge d'une branche qui touche un fichier **single-owner**
   (`prisma/schema.prisma`, `package.json`, `pnpm-lock.yaml`, `next.config.*`,
   `tailwind.config.*`, `src/app/api/cockpit-chat/route.ts`,
   `src/lib/llm/tools/registry.ts`, `src/lib/canvas/{compose,emit}.ts`,
   `src/app/globals.css`, `src/app/doc-flow.css`, `src/app/admin/admin-proof.css`,
   `docs/agent-file-locks.md`, `CLAUDE.md`, `.mcp.json`) → verdict `REVIEW_SINGLE_OWNER`,
   tu **demandes à Adrien** et tu attends.
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

### 3. Gate typecheck (pour chaque `MERGE_CANDIDATE`)
Le « sans conflit git » ne garantit pas que ça compile. Avant de merger, valide le
**résultat du merge** dans un worktree jetable :
```bash
git fetch origin >/dev/null 2>&1
TMP="../.orchestrator-validate"
git worktree add -d "$TMP" origin/main >/dev/null 2>&1
git -C "$TMP" merge --no-ff --no-commit origin/<BRANCHE> >/dev/null 2>&1   # merge à blanc
# si le merge à blanc échoue → CONFLICT_REBASE, abandonne ce candidat
( cd "$TMP" && pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1; pnpm typecheck )
RES=$?
git -C "$TMP" merge --abort 2>/dev/null
git worktree remove --force "$TMP" 2>/dev/null
```
- `pnpm typecheck` **vert (RES=0)** → étape 4 (merge réel).
- **rouge** → verdict `BLOCKED_TYPECHECK`, tu ne merges pas, tu rapportes l'erreur tsc
  (l'agent propriétaire doit corriger). Tu passes au candidat suivant.

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
