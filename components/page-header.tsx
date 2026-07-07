import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderTone = "blue" | "green" | "amber" | "rose" | "slate";

type PageHeaderStat = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: PageHeaderTone;
};

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: ReactNode;
  kicker?: string;
  stats?: PageHeaderStat[];
};

const toneClasses: Record<PageHeaderTone, { icon: string; accent: string }> = {
  blue: {
    icon: "bg-blue-50 text-blue-700 ring-blue-100",
    accent: "bg-blue-500"
  },
  green: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    accent: "bg-emerald-500"
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    accent: "bg-amber-500"
  },
  rose: {
    icon: "bg-rose-50 text-rose-700 ring-rose-100",
    accent: "bg-rose-500"
  },
  slate: {
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    accent: "bg-slate-950"
  }
};

export function PageHeader({ eyebrow, title, description, icon: Icon, actions, kicker = "Live workspace", stats = [] }: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-white/90 shadow-panel">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#0f172a_0%,#2563eb_32%,#10b981_68%,#f59e0b_100%)]" />
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700">
              <Icon size={15} />
              {eyebrow}
            </span>
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {kicker}
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {stats.map((stat) => {
            const tone = toneClasses[stat.tone ?? "slate"];
            const StatIcon = stat.icon;
            return (
              <div key={`${stat.label}-${stat.value}`} className="relative min-h-[104px] overflow-hidden rounded-md border border-slate-200 bg-slate-50/80 p-3">
                <div className={cn("absolute inset-y-0 left-0 w-1", tone.accent)} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold uppercase text-slate-500">{stat.label}</div>
                    <div className="mt-1 truncate text-xl font-semibold text-slate-950">{stat.value}</div>
                    <div className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-slate-500">{stat.detail}</div>
                  </div>
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1", tone.icon)}>
                    <StatIcon size={16} />
                  </span>
                </div>
              </div>
            );
          })}
          {stats.length === 0 ? (
            <div className="flex min-h-[104px] items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/80 p-3 text-sm font-semibold text-slate-700">
              <span>Open a workflow</span>
              <ArrowRight size={16} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
