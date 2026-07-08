"use client";

import { useEffect, useRef } from "react";

type UseLiveRefreshOptions = {
  onRefresh: () => void | Promise<void>;
  intervalMs?: number;
};

export function useLiveRefresh({ onRefresh, intervalMs = 30000 }: UseLiveRefreshOptions) {
  const lastRevision = useRef<string | null>(null);
  const refreshing = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    let cancelled = false;

    async function checkRevision() {
      if (refreshing.current || document.visibilityState === "hidden") return;
      refreshing.current = true;

      try {
        const response = await fetch("/api/live/revision", { cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json().catch(() => null);
        const revision = typeof payload?.revision === "string" ? payload.revision : null;

        if (!revision || revision === "offline" || cancelled) return;
        if (lastRevision.current === null) {
          lastRevision.current = revision;
          return;
        }

        if (revision !== lastRevision.current) {
          lastRevision.current = revision;
          await onRefreshRef.current();
        }
      } finally {
        refreshing.current = false;
      }
    }

    const interval = window.setInterval(checkRevision, intervalMs);
    void checkRevision();

    function handleVisibilityChange() {
      void checkRevision();
    }

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);
}
