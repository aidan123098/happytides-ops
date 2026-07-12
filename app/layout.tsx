import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "HappyTides Ops",
  description: "Internal sales, inventory, customer, and analytics dashboard for HappyTides."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <AppShell currentUser={currentUser}>{children}</AppShell>
      </body>
    </html>
  );
}
