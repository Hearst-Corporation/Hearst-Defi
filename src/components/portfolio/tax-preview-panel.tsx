import type { TaxPreview } from "@/lib/portfolio/tax";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtUsd(n: number): string {
  return usdFmt.format(n);
}

function TaxRows({
  rows,
}: {
  rows: ReadonlyArray<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <dl className="pf-stack pf-stack--dense">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>
            <span className="tabular">{row.value}</span>
            {row.hint ? (
              <span className="body-xs ct-text-muted block mt-0.5">{row.hint}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface TaxPreviewPanelProps {
  preview: TaxPreview;
}

/**
 * YTD tax preview — 1099-INT, 1099-B, CRS. Preview only; not filed documents.
 */
export function TaxPreviewPanel({ preview }: TaxPreviewPanelProps) {
  const { form1099Int, form1099B, crs } = preview;
  const year = form1099Int.taxYear;

  return (
    <div
      className="pf-tax-preview"
      data-testid="tax-preview-panel"
      data-section="tax-preview"
    >
      <p className="body-sm ct-text-muted m-0 pf-tax-preview__banner">
        Preview only — figures are derived from your ledger and positions. Final
        tax documents are issued annually. Not tax advice.
      </p>

      <div className="pf-tax-preview__grid">
        <PfCockpitPanel variant="compact" aria-label="1099-INT preview">
          <PfCockpitPanelHeader
            title="1099-INT"
            subtitle={`Interest income · ${year}`}
            provenance="estimated"
            titleVariant="primary"
          />
          <TaxRows
            rows={[
              {
                label: "Box 1 — Interest income",
                value: fmtUsd(form1099Int.interestIncomeUsd),
              },
              {
                label: "Box 4 — Federal withheld",
                value: fmtUsd(form1099Int.federalTaxWithheldUsd),
              },
              {
                label: "YTD cut date",
                value: form1099Int.ytdCutDate,
              },
            ]}
          />
        </PfCockpitPanel>

        <PfCockpitPanel variant="compact" aria-label="1099-B preview">
          <PfCockpitPanelHeader
            title="1099-B"
            subtitle={`Cost basis & notional gains · ${year}`}
            provenance="estimated"
            titleVariant="primary"
          />
          <TaxRows
            rows={[
              {
                label: "Box 1d — Proceeds",
                value: fmtUsd(form1099B.proceedsUsd),
                hint: "No disposition during soft lock-up",
              },
              {
                label: "Box 1e — Cost basis",
                value: fmtUsd(form1099B.costBasisUsd),
              },
              {
                label: "Short-term gain/loss",
                value: fmtUsd(form1099B.shortTermGainLossUsd),
              },
              {
                label: "Long-term gain/loss",
                value: fmtUsd(form1099B.longTermGainLossUsd),
              },
            ]}
          />
        </PfCockpitPanel>

        <PfCockpitPanel variant="compact" aria-label="CRS preview">
          <PfCockpitPanelHeader
            title="CRS"
            subtitle={`${crs.residenceCountry} · ${crs.reportingYear}`}
            provenance="estimated"
            titleVariant="primary"
          />
          <TaxRows
            rows={[
              {
                label: "Account balance",
                value: fmtUsd(crs.accountBalanceUsd),
              },
              {
                label: "Gross interest",
                value: fmtUsd(crs.grossInterestUsd),
              },
              {
                label: "Other income (mining)",
                value: fmtUsd(crs.otherIncomeUsd),
              },
            ]}
          />
        </PfCockpitPanel>
      </div>
    </div>
  );
}

export function TaxPreviewEmpty() {
  return (
    <PfCockpitPanel variant="wide" aria-label="Tax preview unavailable">
      <PfCockpitPanelHeader
        title="Tax preview"
        subtitle="Sign in with an active position to view YTD figures."
        titleVariant="primary"
      />
      <p className="body-sm ct-text-muted m-0">
        Final 1099 and CRS documents are issued after year-end. This cockpit
        shows a non-filed preview when your account has ledger history.
      </p>
    </PfCockpitPanel>
  );
}
