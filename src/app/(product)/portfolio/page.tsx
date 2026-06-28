import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description: "Your positions and distributions",
};

export default function PortfolioPage() {
  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8">
      
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.8fr_minmax(300px,1fr)] gap-5">

          {/* Top Bar (spans full width of hero) */}
          <div className="lg:col-span-2 flex flex-wrap items-center justify-between pb-3 border-b border-white/10 mb-1 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">HYV · Investor Cockpit</span>
              <h1 className="text-[24px] font-semibold tracking-tight text-white">Portfolio <span className="text-[#A7FB90]">Cockpit</span></h1>
              {/* Honesty: these figures are illustrative placeholders, not a live
                  position feed. Surfaced as demo data until the portfolio loader is
                  wired (see docs/PORTFOLIO_ZERO_CONTRACT.md). */}
              <Badge color="amber" className="mt-1 w-fit text-[10px]! uppercase tracking-widest">Demo data · pending live portfolio wiring</Badge>
            </div>
            <div className="text-xs font-medium text-zinc-400">
              Welcome back, <span className="text-[#A7FB90]">Investor</span>
            </div>
          </div>

          {/* Chart Panel */}
          <div className="rounded-2xl border border-white/10 bg-black shadow-sm flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-start justify-between px-5 pt-5 pb-2 relative z-20 gap-4">
              <div className="flex flex-col gap-1.5 min-w-0">
                <h2 className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Portfolio Value <span className="text-zinc-600 normal-case tracking-normal">(demo)</span></h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-medium text-zinc-500">$</span>
                  <span className="text-[32px] font-medium text-white tracking-tight leading-none">509,800.00</span>
                </div>
              </div>
              <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 shrink-0">
                <button className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors rounded-md">24H</button>
                <button className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors rounded-md">7D</button>
                <button className="px-3 py-1.5 text-[10px] font-bold text-zinc-900 bg-white shadow-sm rounded-md">30D</button>
                <button className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors rounded-md">ALL</button>
              </div>
            </div>

            <div className="flex-1 min-h-[200px] flex items-center justify-center relative">
               <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-60">
                 <path d="M0,150 C100,150 200,100 300,120 C400,140 500,60 600,40 L600,200 L0,200 Z" fill="url(#chart-gradient)" />
                 <path d="M0,150 C100,150 200,100 300,120 C400,140 500,60 600,40" fill="none" stroke="#A7FB90" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                 <circle cx="600" cy="40" r="4" fill="#181D21" stroke="#A7FB90" strokeWidth="2" />
                 <defs>
                   <linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1">
                     <stop offset="0%" stopColor="#A7FB90" stopOpacity="0.15" />
                     <stop offset="100%" stopColor="#A7FB90" stopOpacity="0" />
                   </linearGradient>
                 </defs>
               </svg>
               <span className="text-sm text-zinc-500 font-medium relative z-10">[ Chart Placeholder ]</span>
            </div>
          </div>

          {/* Status Tiles */}
          <div className="rounded-2xl border border-white/10 bg-black shadow-sm p-6 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Principal</div>
                <div className="text-[18px] font-medium text-white leading-none tracking-tight">$500,000</div>
                <div className="text-[10px] text-zinc-500 tracking-wide mt-0.5">Net deposits</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Positions</div>
                <div className="text-[18px] font-medium text-white leading-none tracking-tight">1</div>
                <div className="text-[10px] text-zinc-500 tracking-wide mt-0.5">Active Vaults</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Deployed</div>
                <div className="text-[18px] font-medium text-white leading-none tracking-tight">98.0%</div>
                <div className="text-[10px] text-zinc-500 tracking-wide mt-0.5">Capital Efficiency</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-white">Accrued Yield</div>
                <div className="text-[18px] font-medium text-[#A7FB90] leading-none tracking-tight">+$9,800</div>
                <div className="text-[10px] text-zinc-500 tracking-wide mt-0.5">Since inception</div>
              </div>
            </div>
          </div>
        </section>

        {/* CAPITAL & YIELD SECTION */}
        <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/5">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">Capital & Yield</h2>
              <p className="text-[12px] text-zinc-500 tracking-wide">Active capital · 12m forward yield</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-white/5 bg-[#15191C]">
            <div className="flex flex-col gap-2 p-5 md:px-6 border-b md:border-b-0 md:border-r border-white/5">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Capital Active</div>
              <div className="text-[22px] font-medium text-white leading-none tracking-tight">$250K</div>
            </div>
            <div className="flex flex-col gap-2 p-5 md:px-6 border-b md:border-b-0 md:border-r border-white/5">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Target APY</div>
              <div className="text-[22px] font-medium text-white leading-none tracking-tight flex items-baseline gap-1.5">
                9.4 <span className="text-base text-zinc-500 font-normal mx-0.5">—</span> 12.8 <span className="text-base text-zinc-500 font-normal">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-5 md:px-6">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Forward Horizon</div>
              <div className="text-[22px] font-medium text-white leading-none tracking-tight">12m</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] items-center gap-8 p-6">
            <div className="relative size-[160px] shrink-0 mx-auto md:mx-0">
              <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="66" fill="none" stroke="#15191C" strokeWidth="16" />
                <circle cx="80" cy="80" r="66" fill="none" stroke="#A7FB90" strokeWidth="16" strokeDasharray="228 186" strokeLinecap="round" />
                <circle cx="80" cy="80" r="66" fill="none" stroke="rgba(167,251,144,0.5)" strokeWidth="16" strokeDasharray="124 290" strokeLinecap="round" transform="rotate(108 80 80)" />
                <circle cx="80" cy="80" r="66" fill="none" stroke="rgba(167,251,144,0.25)" strokeWidth="16" strokeDasharray="62 352" strokeLinecap="round" transform="rotate(216 80 80)" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500">Capital</span>
                <span className="text-[22px] font-medium text-white leading-none">$250K</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 min-w-0">
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 pb-3 border-b border-white/5">
                <div className="size-2.5 rounded-full border-2 border-[#15191C] bg-[#A7FB90]"></div>
                <span className="text-[13px] font-medium text-zinc-200">Mining Operations</span>
                <span className="text-sm font-bold text-white tabular-nums">55%</span>
                <span className="text-[13px] font-mono text-zinc-500 w-12 text-right tabular-nums">±8.5%</span>
              </div>
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 pb-3 border-b border-white/5">
                <div className="size-2.5 rounded-full border-2 border-[#15191C] bg-[#A7FB90]/50"></div>
                <span className="text-[13px] font-medium text-zinc-200">USDC Base Yield</span>
                <span className="text-sm font-bold text-white tabular-nums">30%</span>
                <span className="text-[13px] font-mono text-[#A7FB90] w-12 text-right tabular-nums">+3.8%</span>
              </div>
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4">
                <div className="size-2.5 rounded-full border-2 border-[#15191C] bg-[#A7FB90]/25"></div>
                <span className="text-[13px] font-medium text-zinc-200">BTC Tactical</span>
                <span className="text-sm font-bold text-white tabular-nums">15%</span>
                <span className="text-[13px] font-mono text-zinc-500 w-12 text-right tabular-nums">±1.6%</span>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="flex justify-between items-end mb-3">
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Target APY Range</span>
              <span className="text-[18px] font-medium text-[#A7FB90] leading-none">9.4—12.8%</span>
            </div>
            <div className="relative h-2 bg-[#15191C] rounded-full border border-white/5 mb-3">
              <div className="absolute top-0 bottom-0 left-0 right-0 bg-[#A7FB90] rounded-full"></div>
              <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 size-3 rounded-full bg-white border-2 border-[#15191C]"></div>
              <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 size-3 rounded-full bg-white border-2 border-[#15191C]"></div>
            </div>
            <div className="flex justify-between text-[12px] font-mono text-zinc-500 tracking-wide">
              <span>9.4%</span>
              <span>12.8%</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-zinc-500">
              <div className="size-1 bg-zinc-500 rounded-full"></div>
              Conditional projection — not guaranteed · v1.0
            </div>
          </div>
        </section>

        {/* DECK SECTION (Calendar + Activity) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Calendar Panel */}
          <div className="rounded-2xl border border-white/10 bg-black shadow-sm flex flex-col">
            <div className="p-5 border-b border-white/5">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">Distribution Calendar</h2>
                <p className="text-[12px] text-zinc-500 tracking-wide">Upcoming payouts</p>
              </div>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[220px]">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 mb-3">Next Distribution</div>
              <div className="text-[32px] font-medium text-white leading-none tracking-tight mb-2">Jun 30</div>
              <div className="text-[13px] text-[#A7FB90] font-medium">Estimated ~$8,400</div>
              <div className="mt-6 text-[10px] text-zinc-500 uppercase tracking-widest">Monthly USDC · T+5 settlement</div>
            </div>
          </div>

          {/* Activity Panel */}
          <div className="rounded-2xl border border-white/10 bg-black shadow-sm flex flex-col">
            <div className="p-5 border-b border-white/5">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">Recent Activity</h2>
                <p className="text-[12px] text-zinc-500 tracking-wide">Deposits & payouts</p>
              </div>
            </div>
            
            <div className="p-6">
              <ul role="list" className="space-y-5">
                <li className="relative flex gap-x-4">
                  <div className="absolute top-0 -bottom-5 left-0 flex w-6 justify-center">
                    <div className="w-px bg-white/10"></div>
                  </div>
                  <div className="relative flex size-6 flex-none items-center justify-center bg-black ring-1 ring-white/5 rounded-full">
                    <div className="size-2 rounded-full bg-[#A7FB90] ring-4 ring-[#111417]"></div>
                  </div>
                  <div className="flex-auto py-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] text-zinc-400">
                        <span className="font-medium text-white">Distribution</span> (Estimated)
                      </p>
                      <time dateTime="2026-06-30" className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        ~Jun 30
                      </time>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">Hearst Yield Vault</p>
                  </div>
                </li>

                <li className="relative flex gap-x-4">
                  <div className="absolute top-0 -bottom-5 left-0 flex w-6 justify-center">
                    <div className="w-px bg-white/10"></div>
                  </div>
                  <div className="relative flex size-6 flex-none items-center justify-center bg-black ring-1 ring-white/5 rounded-full">
                    <div className="size-1.5 rounded-full bg-white/20"></div>
                  </div>
                  <div className="flex-auto py-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] text-zinc-400">
                        <span className="font-medium text-white">Deposit</span>
                      </p>
                      <span className="text-[13px] font-semibold text-[#A7FB90]">+$11.00</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Hearst Yield Vault</p>
                      <time dateTime="2026-06-24" className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                        3 days ago
                      </time>
                    </div>
                  </div>
                </li>

                <li className="relative flex gap-x-4">
                  <div className="absolute top-0 left-0 flex h-6 w-6 justify-center">
                    <div className="w-px bg-white/10"></div>
                  </div>
                  <div className="relative flex size-6 flex-none items-center justify-center bg-black ring-1 ring-white/5 rounded-full">
                    <div className="size-1.5 rounded-full bg-white/20"></div>
                  </div>
                  <div className="flex-auto py-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] text-zinc-400">
                        <span className="font-medium text-white">Yield Distribution</span>
                      </p>
                      <span className="text-[13px] font-semibold text-white">+$8,380.00</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Hearst Yield Vault</p>
                      <time dateTime="2026-05-31" className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                        May 31, 2026
                      </time>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* POSITIONS SECTION */}
        <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-4 p-5 border-b border-white/5">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">Active Positions</h2>
              <p className="text-[12px] text-zinc-500 tracking-wide">Your deployed capital</p>
            </div>
            <Badge color="zinc" className="text-[10px]! uppercase tracking-widest bg-white/5 shrink-0 self-start mt-0.5">1 active</Badge>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-full text-sm">
              <TableHead>
                <TableRow>
                  <TableHeader className="pl-5 bg-transparent text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Vault Name</TableHeader>
                  <TableHeader className="bg-transparent text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Status</TableHeader>
                  <TableHeader className="bg-transparent text-right text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Position</TableHeader>
                  <TableHeader className="bg-transparent text-right text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Target APY</TableHeader>
                  <TableHeader className="pr-5 bg-transparent"><span className="sr-only">Details</span></TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow className="hover:bg-white/[0.02] transition-colors border-transparent">
                  <TableCell className="pl-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-9 rounded-full bg-[#A7FB90]"></div>
                      <div>
                        <div className="font-medium text-white text-[14px]">Hearst Yield Vault</div>
                        <div className="mt-1 text-zinc-500 text-[10px] uppercase tracking-wider">Monthly USDC Distributions</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge color="green" className="text-[10px]! uppercase tracking-widest">Active</Badge>
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="text-[15px] font-medium text-white">$509,800.00</div>
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="text-[15px] font-medium text-[#A7FB90]">9.4 <span className="text-zinc-500 mx-0.5">—</span> 12.8 <span className="text-zinc-500">%</span></div>
                  </TableCell>
                  <TableCell className="text-right pr-5 py-4">
                    <span className="sr-only">Details unavailable in demo layout</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

      </div>
    </div>
  );
}
