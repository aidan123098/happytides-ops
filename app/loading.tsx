export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading page">
      <div className="space-y-3 border-b border-slate-200/80 pb-6">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="h-9 w-56 max-w-full rounded bg-slate-200" />
        <div className="h-4 w-full max-w-xl rounded bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-80 rounded-lg border border-slate-200 bg-white" />
    </div>
  );
}
