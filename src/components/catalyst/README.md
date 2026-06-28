# Catalyst components — Canonical UI layer

This folder is the canonical UI component layer for Hearst Connect.

Catalyst components must be branded with cockpit tokens:

- `--ct-accent`
- `--ct-border`
- `--ct-border-soft`
- `--ct-text-strong`
- `--ct-text-body`
- `--ct-text-muted`
- `--ct-status-success`
- `--ct-status-warning`
- `--ct-status-danger`

Do not introduce raw Tailwind blue/zinc styling as the visual authority.
Do not use raw `#A7FB90` outside token definitions.
Do not create page-local Badge/Button/Table/Input primitives.

When a legacy `src/components/ui/*` primitive overlaps with Catalyst, migrate the usage toward Catalyst.

## Scope

This is the **destination** layer. New Button / Badge / Table / Input / Select /
Card / Dialog / Field surfaces are built or extended here, not in `src/components/ui/`.

The shell, rails, layout contract and `--ct-*` token definitions live in
`cockpit-shell/` — Catalyst consumes those tokens, it does not redefine them.

## Branding rules

- Focus ring = `--ct-accent` (never `ring-blue` / `focus:ring-blue`).
- Borders = `var(--ct-border)` / `var(--ct-border-soft)`.
- Text = `var(--ct-text-*)`.
- Status = `var(--ct-status-*)`.
- Green = `var(--ct-accent)` (one green only).

See the repo-root `README_DESIGN_SYSTEM.md` for the full authority statement and
the migration playbook from `src/components/ui/` into this layer.
