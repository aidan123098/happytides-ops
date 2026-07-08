import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getShellPulse } from "@/lib/services/operational-data";
import "./globals.css";

export const metadata: Metadata = {
  title: "HappyTides Ops",
  description: "Internal sales, inventory, customer, and analytics dashboard for HappyTides."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [currentUser, pulse] = await Promise.all([getCurrentUser(), getShellPulse()]);

  return (
    <html lang="en">
      <body>
        <AppShell
          currentUser={currentUser}
          pulse={{
            revenueTodayCents: pulse.revenueTodayCents,
            ordersToday: pulse.ordersToday,
            lowStockCount: pulse.lowStockCount,
            unitsToday: pulse.unitsToday
          }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
