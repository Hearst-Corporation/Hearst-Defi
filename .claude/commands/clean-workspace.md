---
description: Nettoie le clutter gitignoré (PNG/JPEG root, scratch scripts, dumps, .playwright-mcp, release*) — DRY-RUN par défaut
allowed-tools: Bash(bash scripts/clean-workspace.sh:*), Bash(du:*), Bash(ls:*), Bash(test:*), Bash(git status)
---

# /clean-workspace — nettoyage du clutter (DRY-RUN par défaut)

Objectif : libérer l'espace en supprimant le clutter **déjà gitignoré** (jamais un
fichier suivi) : ~118 PNG + 19 JPEG racine, scratch scripts (scan_*.js,
screenshot*.js, audit_profile.py…), rapports HTML d'audit, dumps, `.playwright-mcp/`
(1852 entrées), `release/` (991M), `releases/` (117M), `tsconfig.tsbuildinfo`, `.tmp/`,
`tmp/`, `.jscpd-report/`, `dist-electron/`, `build/`, `dev.db` 0-octet.

Le script ne touche AUCUN fichier suivi par git et tourne en DRY-RUN tant que `--apply` n'est pas passé.

## Étapes

1. **Vérifier la présence du script.** Sinon STOP :
   ```bash
   test -f "scripts/clean-workspace.sh" || { echo "❌ scripts/clean-workspace.sh absent — l'axe Cleanup ne l'a pas encore livré. STOP."; exit 0; }
   ```
2. **DRY-RUN (défaut, aucune suppression)** — lister ce qui SERAIT supprimé + l'espace récupérable :
   ```bash
   bash scripts/clean-workspace.sh
   ```
3. **Présenter le plan** à Adrien : nombre de fichiers, taille totale, top dossiers. Confirmer qu'aucun fichier suivi n'est listé (`git status` reste propre).
4. **DEMANDER avant d'appliquer.** N'exécute le `--apply` QUE si Adrien confirme explicitement :
   ```bash
   bash scripts/clean-workspace.sh --apply
   ```

## STOP

- **Confirmation OBLIGATOIRE avant `--apply`** — pas de suppression sans accord explicite, même si tout est gitignoré.
- Si le DRY-RUN liste un fichier SUIVI : STOP immédiat, bug du script, ne pas appliquer.
- Ne jamais `git add`/`commit`/`push` — le nettoyage est local, l'arbre git reste intact.
