import { cn } from "@/lib/utils";

type DataTableProps = {
  columns: string[];
  children: React.ReactNode;
  className?: string;
};

export function DataTable({ columns, children, className }: DataTableProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-slate-200/80 bg-white/90 shadow-sm", className)}>
      <div className="max-h-[680px] overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 text-[11px] text-slate-500 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-slate-200/80 px-4 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 [&_tr]:transition-colors [&_tr:hover]:bg-slate-50/80">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle text-slate-700", className)} {...props} />;
}
