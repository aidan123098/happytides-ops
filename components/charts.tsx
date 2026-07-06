"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { Product, RevenuePoint } from "@/types/domain";

type MoneyTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
};

function MoneyTooltip({ active, payload, label }: MoneyTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-panel">
      <div className="font-medium text-slate-950">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="mt-1 text-slate-600">
          {entry.name}: ${entry.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

function EmptyChartState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <div>
        <div className="mx-auto h-1 w-16 rounded-full bg-slate-300" />
        <p className="mt-4 text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const hasData = data.some((point) => point.revenue > 0 || point.orders > 0 || point.units > 0);

  if (!hasData) {
    return (
      <div className="h-72">
        <EmptyChartState title="No revenue recorded yet" detail="Completed orders will populate this trend once live sales are imported or entered." />
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.24} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
          <Tooltip content={<MoneyTooltip />} />
          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={3} fill="url(#revenueFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProductMixChart({ products }: { products: Product[] }) {
  const data = products.slice(0, 5).map((product) => ({
    name: product.name,
    value: product.unitsSoldWeek,
    color: product.colorAccent
  }));
  const hasData = data.some((entry) => entry.value > 0);

  if (!hasData) {
    return (
      <div className="mb-4 h-64">
        <EmptyChartState title="No product sales yet" detail="Product mix will appear after the first paid order is tracked." />
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
