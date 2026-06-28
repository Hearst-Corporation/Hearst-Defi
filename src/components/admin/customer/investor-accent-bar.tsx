/** Vertical accent rule shown to the left of an identity cell (Portfolio
 *  "Active Positions" canon). Single green via the --ct-accent token — never a
 *  raw #A7FB90 in the page. */
export function InvestorAccentBar() {
  return (
    <div
      aria-hidden="true"
      className="h-7 w-1 shrink-0 rounded-full bg-[var(--ct-accent)]"
    />
  );
}
