"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { computeConstructionROI } from "@/lib/engine/construction";
import type { ConstructionInputs } from "@/lib/engine/types";
import { cn } from "@/lib/cn";

const INITIAL_INPUTS: ConstructionInputs = {
  capacity_mw: 100,
  infra_cost_usd_mw: 650000,
  asic_efficiency_j_th: 15,
  asic_cost_usd_th: 12,
  energy_cost_kwh: 0.045,
  hashprice_usd_th_day: 0.042,
};

interface ConstructionFieldMeta {
  key: keyof ConstructionInputs;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const FIELDS: ConstructionFieldMeta[] = [
  {
    key: "capacity_mw",
    label: "Target Capacity",
    unit: "MW",
    min: 10,
    max: 1000,
    step: 10,
    format: (v) => `${v} MW`,
  },
  {
    key: "infra_cost_usd_mw",
    label: "Infra Cost",
    unit: "$/MW",
    min: 300000,
    max: 1200000,
    step: 10000,
    format: (v) => `$${(v / 1000).toFixed(0)}k/MW`,
  },
  {
    key: "asic_efficiency_j_th",
    label: "ASIC Efficiency",
    unit: "J/TH",
    min: 10,
    max: 40,
    step: 0.5,
    format: (v) => `${v} J/TH`,
  },
  {
    key: "asic_cost_usd_th",
    label: "ASIC Cost",
    unit: "$/TH",
    min: 5,
    max: 30,
    step: 0.5,
    format: (v) => `$${v}/TH`,
  },
  {
    key: "energy_cost_kwh",
    label: "Energy Cost",
    unit: "$/kWh",
    min: 0.02,
    max: 0.12,
    step: 0.001,
    format: (v) => `$${v.toFixed(3)}/kWh`,
  },
  {
    key: "hashprice_usd_th_day",
    label: "Hashprice",
    unit: "$/TH/day",
    min: 0.02,
    max: 0.15,
    step: 0.001,
    format: (v) => `$${v.toFixed(3)}`,
  },
];

export function ConstructionTab() {
  const [inputs, setInputs] = useState<ConstructionInputs>(INITIAL_INPUTS);
  const output = useMemo(() => computeConstructionROI(inputs), [inputs]);

  function handleChange(key: keyof ConstructionInputs, raw: string) {
    const v = parseFloat(raw);
    if (isNaN(v)) return;
    setInputs((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <div className="scenario-lab-workspace">
      {/* Inputs Panel */}
      <Card className="scenario-lab-input-card p-0" hoverOverlay={false}>
        <CardHeader className="scenario-lab-input-card__header">
          <div className="min-w-0">
            <CardTitle>Construction Inputs</CardTitle>
            <p className="mt-[var(--ct-space-0_5)] body-xs ct-text-muted">
              Model your data center parameters.
            </p>
          </div>
        </CardHeader>

        <div className="scenario-lab-input-scroll p-(--ct-space-6) pt-0">
          <div className="divide-y ct-divide-soft">
            {FIELDS.map((field) => {
              const value = inputs[field.key];
              const pct = ((value - field.min) / (field.max - field.min)) * 100;

              return (
                <div key={field.key} className="py-(--ct-space-5) first:pt-0 last:pb-0">
                  <div className="mb-(--ct-space-3) admin-doc-inline-row admin-doc-inline-row--between items-baseline">
                    <label htmlFor={`slider-${field.key}`} className="stat-label">
                      {field.label}
                    </label>
                    <span className="mono stat-value tabular-nums ct-text-primary">
                      {field.format(value)}
                    </span>
                  </div>
                  <input
                    id={`slider-${field.key}`}
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={value}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="slider-track w-full cursor-pointer"
                    style={{ "--slider-pct": `${pct}%` } as React.CSSProperties}
                  />
                  <div className="mt-(--ct-space-1_5) admin-doc-row-spread">
                    <span className="body-xs ct-text-muted">{field.min}</span>
                    <span className="body-xs ct-text-muted">{field.max}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Output Panel */}
      <section className="min-h-0 flex flex-col gap-(--ct-space-4)">
        <Card className="scenario-lab-output-card p-(--ct-space-8)" hoverOverlay={false}>
          <CardHeader className="p-0 mb-(--ct-space-8)">
            <div className="min-w-0">
              <CardTitle>Projection Output</CardTitle>
              <p className="mt-[var(--ct-space-0_5)] body-xs ct-text-muted">
                CAPEX, OPEX and ROI estimates.
              </p>
            </div>
          </CardHeader>

          <div className="admin-doc-stack--roomy">
            {/* Primary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-(--ct-space-6)">
              <div className="admin-doc-stack--tight">
                <span className="stat-label">Total CAPEX</span>
                <span className="mono text-2xl ct-text-primary tabular-nums">
                  ${(output.total_capex_usd / 1_000_000).toFixed(1)}M
                </span>
                <span className="body-xs ct-text-muted">
                  Infra: ${(output.infra_capex_usd / 1_000_000).toFixed(1)}M · ASIC: ${(output.asic_capex_usd / 1_000_000).toFixed(1)}M
                </span>
              </div>
              <div className="admin-doc-stack--tight">
                <span className="stat-label">Yearly Net Profit</span>
                <span className="mono text-2xl ct-text-accent tabular-nums">
                  ${(output.yearly_net_profit_usd / 1_000_000).toFixed(2)}M
                </span>
                <span className="body-xs ct-text-muted">
                  Rev: ${(output.yearly_revenue_usd / 1_000_000).toFixed(2)}M · OPEX: ${(output.yearly_opex_usd / 1_000_000).toFixed(2)}M
                </span>
              </div>
              <div className="admin-doc-stack--tight">
                <span className="stat-label">Payback Period</span>
                <span className="mono text-2xl ct-text-primary tabular-nums">
                  {output.payback_months === 999 ? "∞" : output.payback_months} <span className="text-sm font-sans text-muted">months</span>
                </span>
                <span className="body-xs ct-text-muted">
                  ROI 5Y: {output.roi_5y_pct}%
                </span>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="pt-(--ct-space-8) border-t ct-border-soft grid grid-cols-1 sm:grid-cols-2 gap-(--ct-space-8)">
              <div className="admin-doc-stack--tight">
                <span className="stat-label">Break-even Hashprice</span>
                <div className="admin-doc-inline-row admin-doc-inline-row--baseline gap-[var(--ct-space-2)]">
                  <span className="mono text-xl ct-text-primary">
                    ${output.break_even_hashprice.toFixed(4)}
                  </span>
                  <span className="body-xs ct-text-muted">/TH/day</span>
                </div>
                <p className="body-xs ct-text-muted mt-[var(--ct-space-1)]">
                  Minimum hashprice required to cover annual OPEX.
                </p>
              </div>
              <div className="admin-doc-stack--tight">
                <span className="stat-label">Operational Efficiency</span>
                <div className="admin-doc-inline-row admin-doc-inline-row--baseline gap-[var(--ct-space-2)]">
                  <span className="mono text-xl ct-text-primary">
                    {(output.yearly_opex_usd / output.yearly_revenue_usd * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="body-xs ct-text-muted mt-[var(--ct-space-1)]">
                  OPEX as percentage of gross revenue.
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="mt-(--ct-space-8) border-t ct-border-soft pt-(--ct-space-4) body-xs italic ct-text-muted">
              <span className="font-semibold not-italic ct-text-body">Not guaranteed.</span> Projections are based on static market assumptions and do not account for difficulty adjustments or hardware degradation.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
