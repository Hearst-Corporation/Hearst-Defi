"use client";

/**
 * Chart gallery — shadcn/Recharts charts ported onto the Hearst DS (tokenised
 * ui/chart + ui/card). DEMO data for now; dropped into the Report Product so we
 * can see the rendering and decide which charts to wire to real vault data.
 */

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/catalyst/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const areaData = [
  { date: "Apr 1", p50: 222, band: 150 },
  { date: "Apr 8", p50: 240, band: 200 },
  { date: "Apr 15", p50: 167, band: 120 },
  { date: "Apr 22", p50: 290, band: 260 },
  { date: "Apr 29", p50: 320, band: 300 },
  { date: "May 6", p50: 301, band: 340 },
  { date: "May 13", p50: 245, band: 280 },
  { date: "May 20", p50: 360, band: 320 },
  { date: "May 27", p50: 290, band: 300 },
  { date: "Jun 3", p50: 330, band: 350 },
];

const areaConfig = {
  p50: { label: "p50", color: "var(--ct-chart-series-1)" },
  band: { label: "Band", color: "var(--ct-chart-series-2)" },
} satisfies ChartConfig;

const barData = [
  { month: "Jan", value: 186 },
  { month: "Feb", value: 305 },
  { month: "Mar", value: 237 },
  { month: "Apr", value: 173 },
  { month: "May", value: 209 },
  { month: "Jun", value: 214 },
];

const barConfig = {
  value: { label: "Distribution", color: "var(--ct-chart-series-1)" },
} satisfies ChartConfig;

const allocData = [
  { sleeve: "mining", value: 30, fill: "var(--ct-chart-series-1)" },
  { sleeve: "btc", value: 11, fill: "var(--ct-chart-series-2)" },
  { sleeve: "usdc", value: 47, fill: "var(--ct-chart-series-3)" },
  { sleeve: "reserve", value: 12, fill: "var(--ct-chart-series-4)" },
];

const allocConfig = {
  value: { label: "Allocation" },
  mining: { label: "Mining", color: "var(--ct-chart-series-1)" },
  btc: { label: "BTC", color: "var(--ct-chart-series-2)" },
  usdc: { label: "USDC", color: "var(--ct-chart-series-3)" },
  reserve: { label: "Reserve", color: "var(--ct-chart-series-4)" },
} satisfies ChartConfig;

const radarData = [
  { axis: "Yield", value: 186 },
  { axis: "Safety", value: 305 },
  { axis: "Liquidity", value: 237 },
  { axis: "Upside", value: 273 },
  { axis: "Stability", value: 209 },
  { axis: "Cost", value: 214 },
];

const radarConfig = {
  value: { label: "Profile", color: "var(--ct-chart-series-1)" },
} satisfies ChartConfig;

const lineData = [
  { month: "Jan", value: 186 },
  { month: "Feb", value: 305 },
  { month: "Mar", value: 237 },
  { month: "Apr", value: 173 },
  { month: "May", value: 209 },
  { month: "Jun", value: 214 },
];

const lineConfig = {
  value: { label: "Trend", color: "var(--ct-chart-series-1)" },
} satisfies ChartConfig;

const radialData = [
  { sleeve: "mining", value: 30, fill: "var(--ct-chart-series-1)" },
  { sleeve: "btc", value: 11, fill: "var(--ct-chart-series-2)" },
  { sleeve: "usdc", value: 47, fill: "var(--ct-chart-series-3)" },
  { sleeve: "reserve", value: 12, fill: "var(--ct-chart-series-4)" },
];

export function ChartGallery() {
  return (
    <div className="grid gap-(--ct-space-5) lg:grid-cols-2">
      {/* Area — projection band */}
      <Card>
        <CardHeader>
          <CardTitle>Projection — area</CardTitle>
          <CardDescription>p50 vs dispersion band (demo)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={areaConfig} className="aspect-auto h-[var(--ct-chart-h)] w-full">
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="fillP50" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-p50)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-p50)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-band)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-band)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Area dataKey="band" type="natural" fill="url(#fillBand)" stroke="var(--color-band)" stackId="a" />
              <Area dataKey="p50" type="natural" fill="url(#fillP50)" stroke="var(--color-p50)" stackId="a" />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Bar — monthly distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly distribution — bar</CardTitle>
          <CardDescription>per-month target (demo)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="aspect-auto h-[var(--ct-chart-h)] w-full">
            <BarChart data={barData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Pie — allocation */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Allocation — pie</CardTitle>
          <CardDescription>canonical sleeves (demo)</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={allocConfig} className="mx-auto aspect-square max-h-[var(--ct-chart-h)]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="sleeve" hideLabel />} />
              <Pie data={allocData} dataKey="value" nameKey="sleeve" innerRadius={50} outerRadius={85}>
                <Label
                  position="center"
                  content={({ viewBox }) =>
                    viewBox && "cx" in viewBox ? (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle" className="fill-[var(--ct-text-strong)] mono text-[length:var(--ct-text-base)] font-bold">
                        4 sleeves
                      </text>
                    ) : null
                  }
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Radar — risk/return profile */}
      <Card>
        <CardHeader className="items-center">
          <CardTitle>Profile — radar</CardTitle>
          <CardDescription>risk / return axes (demo)</CardDescription>
        </CardHeader>
        <CardContent className="pb-0">
          <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[var(--ct-chart-h)]">
            <RadarChart data={radarData}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <PolarAngleAxis dataKey="axis" />
              <PolarGrid />
              <Radar dataKey="value" fill="var(--color-value)" fillOpacity="var(--ct-opacity-50)" dot={{ r: 3, fillOpacity: 1 }} />
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Line — step */}
      <Card>
        <CardHeader>
          <CardTitle>Trend — line step</CardTitle>
          <CardDescription>stepped (demo)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineConfig} className="aspect-auto h-[var(--ct-chart-h)] w-full">
            <LineChart data={lineData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Line dataKey="value" type="step" stroke="var(--color-value)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Line — dots */}
      <Card>
        <CardHeader>
          <CardTitle>Trend — line dots</CardTitle>
          <CardDescription>natural + dots (demo)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineConfig} className="aspect-auto h-[var(--ct-chart-h)] w-full">
            <LineChart data={lineData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Line dataKey="value" type="natural" stroke="var(--color-value)" strokeWidth={2} dot={{ fill: "var(--color-value)" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Bar — stacked */}
      <Card>
        <CardHeader>
          <CardTitle>Stacked — bar</CardTitle>
          <CardDescription>two series stacked (demo)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={areaConfig} className="aspect-auto h-[var(--ct-chart-h)] w-full">
            <BarChart data={areaData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="band" stackId="a" fill="var(--color-band)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="p50" stackId="a" fill="var(--color-p50)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Radial — allocation */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Allocation — radial</CardTitle>
          <CardDescription>sleeves as radial bars (demo)</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer config={allocConfig} className="mx-auto aspect-square max-h-[var(--ct-chart-h)]">
            <RadialBarChart data={radialData} startAngle={-90} endAngle={270} innerRadius={30} outerRadius={100}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="sleeve" />} />
              <RadialBar dataKey="value" background>
                <LabelList position="insideStart" dataKey="sleeve" className="fill-[var(--ct-bg-deep)] capitalize" fontSize={11} />
              </RadialBar>
            </RadialBarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
