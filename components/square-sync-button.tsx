"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SquareSyncButton({ compact = false }: { compact?: boolean }) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runSync() {
    setSyncing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/square/sync", { method: "POST" });
      const payload = await response.json();
      const checked = payload.ordersChecked ?? payload.paymentsChecked ?? "N/A";
      setMessage(response.ok ? `Square sync checked ${checked} records.` : payload.error ?? "Square sync could not run.");
    } catch {
      setMessage("Square sync could not run.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="relative hidden sm:block">
      <Button variant="secondary" className={compact ? "h-8" : undefined} onClick={runSync} disabled={syncing}>
        <RefreshCw size={16} className={syncing ? "animate-spin" : undefined} />
        {syncing ? "Syncing" : "Import Square"}
      </Button>
      {message ? (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-panel">
          {message}
        </div>
      ) : null}
    </div>
  );
}
