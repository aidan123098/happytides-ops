import { CalendarDays, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

type FilterBarProps = {
  filters: string[];
};

export function FilterBar({ filters }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 p-3 shadow-panel">
      <Button variant="secondary">
        <CalendarDays size={15} />
        Date range
      </Button>
      {filters.map((filter) => (
        <Button key={filter} variant="ghost" className="border border-slate-200 bg-white shadow-sm">
          <Filter size={14} />
          {filter}
        </Button>
      ))}
    </div>
  );
}
