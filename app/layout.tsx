import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/live-metrics";
import { getLocalStore } from "@/lib/local-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "HappyTides Ops",
  description: "Internal sales, inventory, customer, and analytics dashboard for HappyTides."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getCurrentUser();
  const dashboard = getDashboardData(await getLocalStore());

  return (
    <html lang="en">
      <body>
        <AppShell
          currentUser={currentUser}
          pulse={{
            revenueTodayCents: dashboard.metrics.revenueToday,
            ordersToday: dashboard.metrics.orderCountToday,
            lowStockCount: dashboard.metrics.lowStock.length,
            unitsToday: dashboard.metrics.unitsSoldToday
          }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
