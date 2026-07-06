import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "blue" | "green" | "amber" | "slate";
  featured?: boolean;
};

const tones = {
  blue: {
    icon: "bg-blue-50 text-blue-700 ring-blue-100",
    accent: "bg-blue-600"
  },
  green: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    accent: "bg-emerald-500"
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    accent: "bg-amber-500"
  },
  slate: {
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    accent: "bg-slate-950"
  }
};

export function MetricCard({ title, value, detail, icon: Icon, tone = "slate", featured = false }: MetricCardProps) {
  return (
    <Card className={cn("relative overflow-hidden transition-transform hover:-translate-y-0.5", featured && "!border-slate-800 !bg-slate-950 text-white")}>
      <div className={cn("absolute inset-x-0 top-0 h-1", tones[tone].accent)} />
      <CardContent className={cn("p-3 sm:p-4", featured && "p-5 sm:p-6")}>
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className={cn("text-[10px] font-semibold leading-4 text-slate-500 sm:text-xs", featured && "text-slate-300")}>{title}</p>
            <p className={cn("mt-1 whitespace-normal text-xl font-semibold leading-tight text-slate-950 sm:mt-2 sm:text-2xl", featured && "text-3xl text-white sm:text-4xl")}>{value}</p>
            <p className={cn("mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5", featured && "mt-2 text-slate-300")}>{detail}</p>
          </div>
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 sm:h-9 sm:w-9", featured ? "bg-white/10 text-white ring-white/15" : tones[tone].icon)}>
            <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
