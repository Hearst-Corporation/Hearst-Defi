# Agent Workflow — worktrees isolés (règle officielle)

> Source de vérité du **workflow multi-agents** de Hearst Connect.
> Complète, sans la contredire, la section *MANDATORY MULTI-AGENT WORKFLOW* de
> [`CLAUDE.md`](../CLAUDE.md), la discipline de commit de
> [`.cursor/rules/commit-discipline.mdc`](../.cursor/rules/commit-discipline.mdc)
> et l'état vivant des verrous de [`docs/agent-file-locks.md`](agent-file-locks.md).
>
> **Pourquoi ce doc existe :** plusieurs agents ont travaillé en parallèle dans des
> branches/worktrees qui se marchaient dessus → working tree principal instable,
> HEAD qui bouge, commits arrachés, conflits CSS/nav/projection, branches concurrentes.
> Ce qui suit rend cette façon de travailler **déterministe**.

---

## 1. Règle d'or

```txt
Worktree isolé OBLIGATOIRE dès qu'il y a : plusieurs agents en parallèle, du fan-out,
un run long, ou un repo fragile/dirty. Chaque worktree est créé depuis origin/main.

Agent UNIQUE séquentiel : worktree NON obligatoire — repo courant, branche courante
ou feature dédiée suffit (cf. ~/.claude/dev-agent-rules.md §3).

Dans TOUS les cas : jamais deux agents en écriture dans le même working tree.
```

- **Dès qu'il y a du parallèle**, le working tree principal (`connect — Hearst Defi/`)
  **n'est pas une zone de dev partagée** : il sert à `git fetch`, à créer/supprimer des
  worktrees, et à inspecter `main`. Un arbre partagé, sale ou actif entre plusieurs agents
  = absorption de fichiers, conflits, HEAD qui bouge. Un worktree isolé = arbre toujours
  clean, scope contenu.
- **Fichiers partagés entre deux agents → repasser en séquentiel** (pas deux worktrees qui
  éditent les mêmes fichiers).
- Si le worktree/branche de départ n'est pas clean et que le dirty n'est pas le tien →
  **STOP** et rapport. On ne développe jamais par-dessus du travail non committé d'autrui.

---

## 2. Workflow obligatoire (création du worktree)

Toujours partir du **dernier `origin/main`** :

```bash
git fetch origin
git worktree add ../connect-<scope>-<agent> -b <type>/<scope>-<agent> origin/main
cd ../connect-<scope>-<agent>
```

`<type>` ∈ `fix` | `feat` | `chore` | `refactor` | `docs`. `<scope>` = le domaine
(nav, projection, css, outreach…). Exemples réels :

```bash
git worktree add ../connect-nav-p0          -b fix/nav-p0                    origin/main
git worktree add ../connect-projection-menu -b chore/simplify-projection-menu origin/main
git worktree add ../connect-css-purge       -b chore/purge-css-final         origin/main
```

Convention de chemin : worktrees **frères** du repo principal
(`../connect-<scope>-<agent>`) ou sous `/private/tmp/claude-501/wt-<scope>`.
Jamais à l'intérieur du repo principal.

> Worktree neuf = base SQLite vide. Si la tâche touche au runtime :
> `pnpm db:push` (recrée `prisma/dev.db`) et, au besoin, rebuild de
> `better-sqlite3`. Pour une passe **docs-only**, rien de tout ça.

---

## 3. Déclaration de scope (en tête de chaque passe)

Chaque agent **déclare** son périmètre avant d'écrire la moindre ligne :

```txt
Branch:          <type>/<scope>-<agent>
Worktree:        ../connect-<scope>-<agent>
Scope:           <une phrase — ce que fait la passe>
Files allowed:   <chemins exacts éditables>
Files forbidden: <fichiers/zones hors périmètre>
Expected commit: <message de commit prévu>
STOP conditions: <cf. §8>
```

Règles de scope :

- On ne touche **que** les fichiers du `Files allowed`.
- Un fichier hors scope devient nécessaire → **STOP + demander l'accord**, ne pas
  élargir le périmètre en silence.

### Fichiers sensibles à owner unique (un seul agent à la fois)

Ne jamais éditer en parallèle ; réserver explicitement dans
[`agent-file-locks.md`](agent-file-locks.md) avant d'y toucher :

| Fichier | Domaine |
|---|---|
| `src/app/cockpit.css` | DS — valeurs live |
| `src/app/globals.css` | DS — base `@theme` |
| `src/app/doc-flow.css` | DS — doc-flow |
| `src/app/(product)/portfolio/portfolio.css` | Portfolio layout |
| `src/components/**/ConnectShell.tsx` *(shell 3 colonnes)* | Shell |
| `src/app/api/cockpit-chat/route.ts` | Chat engine |
| `src/lib/agentic/intent-router.ts` | Router déterministe |
| `src/lib/agentic/nav-fallback-intent.ts` | Nav fallback |
| `src/lib/llm/tools/registry.ts` | Tool registry |
| `src/lib/canvas/compose.ts`, `src/lib/canvas/emit.ts` | Canvas |
| `prisma/schema.prisma` + `prisma/migrations/**` | Schéma DB |
| `package.json`, `pnpm-lock.yaml`, `next.config.*`, `tailwind.config.*` | Build |
| Toute page **Portfolio / Projection active** | Surfaces produit live |
| `.mcp.json` *(Supabase MCP reste `--read-only`)* | Sécurité |
| `docs/agent-file-locks.md`, `CLAUDE.md` | Coordination |

---

## 4. Staging / commit (chirurgical, jamais large)

**Interdit — sans exception :**

```bash
git add -A
git add -u
git add .
git commit -a
```

**Obligatoire :**

```bash
git status --short
git diff --check                       # pas de marqueurs de conflit, pas de trailing ws
git add path/to/file1 path/to/file2    # uniquement TES fichiers, listés
git diff --staged --name-only          # ne doit contenir QUE ton scope
git commit -m "<type>(<scope>): <message>"
```

Après commit :

```bash
git status --short
git log -1 --oneline
```

- **Un commit = un lot = un owner = un scope.** Hors-scope dans l'index →
  `git restore --staged <path>` ou STOP. Jamais committer le travail d'autrui.
- Incident de référence : un staging large a avalé `docs/DEPLOYMENT.md` dans
  `42bd18d feat(ui)` (2026-06-17). D'où la règle dure.

---

## 5. Push / PR / merge

1. commit sur **sa** branche ;
2. push **la branche** (jamais `main`) ;
3. ouvrir une PR vers `main` ;
4. **ne pas merger sans accord** ;
5. après merge confirmé → release du lock + suppression du worktree.

```bash
git push -u origin <branch>            # jamais `git push origin main` depuis un worktree agent
gh pr create --base main --head <branch> --fill
```

Après merge **confirmé** (PR mergée sur GitHub) :

```bash
cd <repo-principal>
git fetch origin
git worktree remove ../connect-<scope>-<agent>
git branch -d <branch>                 # -d échoue si non mergée → c'est voulu
```

Branche locale non mergeable mais abandonnée (décision explicite) :

```bash
git branch -D <branch>
```

Nettoyage remote optionnel après merge :

```bash
git push origin --delete <branch>
```

> `push main` déclenche le déploiement prod Vercel (`connect.hearst.app`).
> `main` = **intégration gatée uniquement** (PR + CI + merge délibéré). Rien
> n'atteint `main` sans passer le gate. Cf. [`docs/DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 6. Rebase

Avant PR ou merge, se réaligner sur `main` **dans son scope** :

```bash
git fetch origin
git rebase origin/main
```

En cas de conflit :

- résoudre **uniquement** dans son scope ;
- conflit hors scope → **STOP** (ne pas toucher une zone non possédée) ;
- relancer les tests ciblés du domaine, puis repush.

**Interdit :**

- merger `main` dans la branche « pour rattraper » sans raison (préférer rebase) ;
- résoudre un conflit en éditant des zones d'un autre owner ;
- écraser le travail concurrent (`reset --hard`, force-push) sans GO explicite.

---

## 7. Verrous (`docs/agent-file-locks.md`)

État **vivant** des fichiers réservés. Une entrée = une branche/passe.

```txt
Agent | Branch | Worktree | Scope | Locked files | Status | Started | Released
```

Statuts : `active` · `blocked` · `ready-pr` · `merged` · `released` · `abandoned`.

Règles :

- Un fichier locké **ne peut pas** être modifié par un autre agent.
- Besoin urgent d'un fichier locké → **STOP + coordination**, pas de contournement.
- **Release obligatoire** après merge **ou** abandon (déplacer l'entrée vers
  `RELEASED LOCKS`). Ne jamais retirer le lock d'un autre agent sans accord explicite.

L'état des worktrees/branches/PRs réellement vivants est tenu dans la section
**WORKTREE & BRANCH STATE** de [`agent-file-locks.md`](agent-file-locks.md).

---

## 8. STOP conditions

Un agent **s'arrête immédiatement** et demande s'il :

- n'est **pas** dans son worktree isolé ;
- voit `git status` lister des fichiers **hors scope** ;
- constate que **HEAD / `main` bouge** dans son environnement ;
- a besoin d'un **fichier locké** par un autre agent ;
- rencontre un **conflit qui touche une zone hors scope** ;
- voit apparaître un **test rouge nouveau hors scope** ;
- détecte qu'**un autre agent modifie les mêmes fichiers** ;
- serait obligé d'utiliser `git add -A` pour « s'en sortir » ;
- ne sait pas si une page est **source officielle** ou **démo** ;
- voit une **permission/outil refusé** (pas de retry, pas de `--no-verify`).

---

## 9. État courant (coordination) — snapshot 2026-06-28

> Détail vivant et tenu à jour dans la section **WORKTREE & BRANCH STATE** de
> [`agent-file-locks.md`](agent-file-locks.md). Résumé :

- `origin/main` HEAD = `3dd02518` (PR #144 — projection truth source — mergée).
- **PRs ouvertes :** `#114` (outreach regex), `#81` (agentic premium redesign).
- **`purge-css-final`** — purge CSS **parquée**. **Ne pas merger maintenant.**
  **Ne pas rebase** tant que le menu projection n'est pas stabilisé. Ne pas
  toucher au CSS produit dans cette passe.
- **`chore/simplify-projection-menu`** — workstream projection, **mergé** (PR #142).
- **`fix/projection-truth-source` / `fix/projection-truth-source-clean`** —
  contenu intégré à `main` via **#144** ; branches désormais réconciliables/closeables.
- **`main`** porte les derniers lots nav / chat / projection mergés.
- **Worktrees stale** (branche entièrement mergée) : à retirer **après confirmation**
  qu'aucun agent n'y est actif — commandes dans `agent-file-locks.md`.

Garde-fous de cette passe (documentation pure) : **ne pas** merger `purge-css-final`,
**ne pas** rebase la purge, **ne pas** toucher au CSS produit, à la nav, au chat,
au calcul de projection, à l'outreach, à Prisma/migrations.

---

## 10. Checklist de fin de passe

```txt
[ ] worktree isolé depuis origin/main
[ ] scope déclaré, respecté (aucun fichier hors Files allowed)
[ ] lock posé puis libéré (agent-file-locks.md)
[ ] staging chirurgical (git diff --staged = scope only)
[ ] git diff --check propre
[ ] validations ciblées du domaine
[ ] commit + push branche (jamais main)
[ ] PR ouverte, merge seulement sur accord
[ ] worktree supprimé + branche nettoyée après merge
```
