---
description: Scan anti-fuite de secrets sur fichiers suivis + stagés — hits masqués, jamais la valeur en clair
allowed-tools: Bash(bash scripts/secrets-scan.sh:*), Bash(git status), Bash(git diff:*), Bash(ls:*), Bash(cat scripts/secrets-scan.sh)
---

# /secrets-scan — détecteur de fuite de secrets

Objectif : repérer en un clic un secret réel (sk-, ghp_, vcp_, re_, hyper_api_,
sk-ant-, AKIA…, PEM, DSN avec creds) qui aurait atterri dans un fichier **suivi**
ou **stagé**, AVANT le commit. Les `.env*`, `*.pem`, `.env.local` sont gitignorés
(posture solide) — le scan vise les fuites accidentelles hors de ces fichiers.

## Étapes

1. **Vérifier la présence du script.** Sinon STOP :
   ```bash
   test -f "scripts/secrets-scan.sh" || { echo "❌ scripts/secrets-scan.sh absent — l'axe Secrets ne l'a pas encore livré. STOP."; exit 0; }
   ```
2. **Scanner les fichiers suivis + stagés** (le script gère les deux périmètres, sort en DRY-RUN read-only) :
   ```bash
   bash scripts/secrets-scan.sh
   ```
3. **Interpréter le code de sortie** : `0` = propre, `≠0` = au moins un hit.
4. **Rapport.** Pour chaque hit : `fichier:ligne | type de secret | valeur MASQUÉE (4 premiers + ****)`.
   Ne JAMAIS reconstituer ni imprimer la valeur complète. Trier par sévérité (clé live > template).

## STOP

- Si un hit est trouvé dans un fichier **suivi** : STOP — ne pas committer, signaler le fichier à purger/gitignorer.
- Read-only : le scan ne modifie ni ne supprime aucun fichier.
- Rappel posture : la plus grosse exposition réelle est HORS repo (`~/.claude/CLAUDE.md` global, ~25 clés live).
  Ce scan ne la couvre pas — le mentionner mais ne pas y toucher.
