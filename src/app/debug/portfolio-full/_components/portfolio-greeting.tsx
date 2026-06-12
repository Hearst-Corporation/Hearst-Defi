import type { PortfolioData } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/format/usd-compact";

function relativeTime(date: Date, asOf: Date): string {
  const days = Math.floor((asOf.getTime() - date.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

interface PortfolioGreetingProps {
  name: string;
  data: PortfolioData;
}

export function PortfolioGreeting({ name, data }: PortfolioGreetingProps) {
  const count = data.positions.length;
  const asOf = new Date("2026-05-20T09:00:00Z");
  const last = data.recentTransactions[0];

  const recap =
    count === 0
      ? "No active positions yet"
      : `${count} active position${count > 1 ? "s" : ""} · ${formatUsdCompact(
          data.totalValueUsdc,
        )} deployed${last ? ` · last activity ${relativeTime(last.occurredAt, asOf)}` : ""}`;

  return (
    <div className="flex flex-col gap-1.5 mb-2 mt-4">
      <h1 className="h1 m-0">
        Welcome back, <span className="font-medium ct-text-strong">{name}</span>
      </h1>
      <p className="body-xs ct-text-muted mono m-0 opacity-80 uppercase tracking-widest">{recap}</p>
    </div>
  );
}
