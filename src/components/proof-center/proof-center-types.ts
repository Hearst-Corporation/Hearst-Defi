/** When true, parent `ProofCenterSection` owns the visible section h2. */
export type ProofCenterSectionLedProps = {
  sectionLed?: boolean;
  /**
   * Hub (cockpit-panel) mode: render WITHOUT the panel's own `<Card>` surface and
   * WITHOUT its internal `ProofCenterCardHeader`, so the enclosing
   * `dashboard-cockpit-panel` is the single surface and `HubPanelHeader` is the only
   * header. Stays false in `/full` (section-led), where the panel's Card is the sole
   * surface inside the surfaceless `ProofCenterSection`.
   */
  bare?: boolean;
};
