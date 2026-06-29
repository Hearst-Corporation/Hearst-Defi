Automated by **Hearst Nexus** loop run `loop_mqzjfe54-mqzjlg9b`,
executed on the self-hosted GPU1 runner via the Max subscription.

**Mission:** Audit the entire codebase for hardcoded values that should be design tokens, constants, or env vars: colors (hex/rgb/hsl), spacing/size magic numbers, hardcoded UI strings, URLs/hosts/ports, file paths, and any secrets or API keys. For each finding report file:line, the hardcoded value, and the recommended replacement. Report only — do not change behaviour.

Scope: 

Validation commands (must pass before opening a PR):
  - npm run lint
  - npm run typecheck

Review before merge — Nexus never auto-merges.

<!--nexus:agents
{"schemaVersion": 1, "model": "opus", "agents": [{"index": 0, "role": "prisma", "model": "opus", "status": "done", "filesTouched": 1}]}
nexus:agents-->
