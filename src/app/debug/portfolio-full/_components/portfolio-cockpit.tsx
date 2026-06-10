import type { ReactNode } from "react";

interface PortfolioCockpitProps {
  greeting: ReactNode;
  quickActions: ReactNode;
  kpis: ReactNode;
  lockMeter: ReactNode;
  timeToCash: ReactNode;
  donut: ReactNode;
  chart: ReactNode;
  positions: ReactNode;
  activity: ReactNode;
}

export function PortfolioCockpitDebug({
  greeting,
  quickActions,
  kpis,
  lockMeter,
  timeToCash,
  donut,
  chart,
  positions,
  activity,
}: PortfolioCockpitProps) {
  return (
    <div className="flex flex-col h-full min-h-120 gap-12 relative">
      {/* Ambient glow for the dashboard */}
      <div aria-hidden="true" className="absolute -inset-20 z-0 pointer-events-none overflow-hidden">
        <div className="dash-ambient-orb dash-ambient-orb--primary" />
        <div className="dash-ambient-orb dash-ambient-orb--secondary" />
      </div>

      {/* ── Header & Quick Actions ────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 relative z-10">
        <div className="shrink-0">{greeting}</div>
        <div className="shrink-0">{quickActions}</div>
      </div>

      {/* ── Section 1 — Performance & Liquidity (Hero) ────────────────────── */}
      <section className="flex flex-col gap-6 relative z-10">
        {/* Ligne 1 : Top Metrics Row */}
        <div className="shrink-0">{kpis}</div>

        {/* Ligne 2 : ValueChart (2/3) + Liquidity Column (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0 min-h-96">
          <div className="lg:col-span-8 flex flex-col h-full">
            {chart}
          </div>
          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="flex-1">{timeToCash}</div>
            <div className="flex-1">{lockMeter}</div>
          </div>
        </div>
      </section>

      {/* ── Section 2 — Under the Hood (Yield & Trust) ────────────────────── */}
      <section className="flex flex-col gap-6 relative z-10 border-t border-(--ct-border-soft) pt-12">
        {/* Ligne 1 : Yield Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0 min-h-72">
          <div className="lg:col-span-4 flex flex-col h-full">{donut}</div>
          <div className="lg:col-span-8 flex flex-col h-full">
            {/* Yield Stack placeholder in debug */}
            <article className="dash-cell dash-cell-premium flex flex-col p-6 h-full">
              <div className="dash-label">
                <span>Yield Source Stack</span>
                <div className="h-4 w-12 bg-(--ct-surface-3) rounded-full" />
              </div>
              <div className="flex-1 flex items-center justify-center text-(--ct-text-muted) italic">
                Yield stack visualization placeholder
              </div>
            </article>
          </div>
        </div>

        {/* Ligne 2 : Security & Trust */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-64">
           <div className="h-full">
             <article className="dash-cell dash-cell-premium flex flex-col p-6 h-full">
               <div className="dash-label"><span>Risk Pulse</span></div>
               <div className="flex-1 flex items-center justify-center text-(--ct-text-muted) italic">Risk placeholder</div>
             </article>
           </div>
           <div className="h-full">
             <article className="dash-cell dash-cell-premium flex flex-col p-6 h-full">
               <div className="dash-label"><span>Proof Pulse</span></div>
               <div className="flex-1 flex items-center justify-center text-(--ct-text-muted) italic">Proof placeholder</div>
             </article>
           </div>
        </div>
      </section>

      {/* ── Section 3 — Details & History ─────────────────────────────────── */}
      <section className="flex flex-col gap-6 relative z-10 border-t border-(--ct-border-soft) pt-12">
        {/* Positions List — Full width */}
        <div className="flex flex-col min-h-72">{positions}</div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0 min-h-72">
          <div className="lg:col-span-8 flex flex-col h-full">
            {/* Distrib Calendar placeholder */}
            <article className="dash-cell dash-cell-premium flex flex-col p-6 h-full">
              <div className="dash-label"><span>Distributions Calendar</span></div>
              <div className="flex-1 flex items-center justify-center text-(--ct-text-muted) italic">Calendar placeholder</div>
            </article>
          </div>
          <div className="lg:col-span-4 flex flex-col h-full">{activity}</div>
        </div>
      </section>
    </div>
  );
}
