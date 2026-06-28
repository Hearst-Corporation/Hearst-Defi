# Legacy UI primitives — deprecated

This folder is not the Design System authority.

Do not add new visual primitives here.

Target direction:
- migrate product/admin usages toward `src/components/catalyst/`
- keep only temporary compatibility wrappers when needed
- remove files once consumers are gone

Allowed temporarily:
- wrappers that delegate to Catalyst
- non-visual helpers
- compatibility shims during migration

Forbidden:
- new Badge/Button/Table/Input/Card systems
- raw visual recipes
- competing tokens
- blue/zinc/white hardcoded styling as a local DS

## Why this folder still exists

These homegrown primitives are still consumed broadly across product and admin
surfaces. The migration toward Catalyst is **progressive** — files leave this
folder only when their consumers have moved. This is a deprecation, not a brutal
delete: nothing here is removed while it still has call-sites.

## Where the authority lives

- Canonical components → `src/components/catalyst/` (see its `README.md`).
- Shell / layout / tokens → `cockpit-shell/`.
- Full authority statement + migration playbook → repo-root `README_DESIGN_SYSTEM.md`.

Do not describe Catalyst as the intruder. Catalyst is the destination; this folder
is the legacy layer being retired.
