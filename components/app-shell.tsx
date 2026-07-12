"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardList,
  DollarSign,
  LogOut,
  Menu,
  Plus,
  Handshake,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { SessionUser } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Overview", detail: "Command center", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", detail: "Sales workflow", icon: ClipboardList },
  { href: "/customers", label: "Customers", detail: "CRM records", icon: Users },
  { href: "/products", label: "Products", detail: "Catalog and pricing", icon: Package },
  { href: "/inventory", label: "Inventory", detail: "Stock counts", icon: Boxes },
  { href: "/affiliates", label: "Affiliates", detail: "Referral ledger", icon: Handshake },
  { href: "/analytics", label: "Analytics", detail: "Business intelligence", icon: BarChart3 },
  { href: "/settings", label: "Settings", detail: "Controls", icon: Settings }
] as const;

const commandItems = [
  ...navItems.map((item) => ({ ...item, type: "Open" })),
  { href: "/orders/new?returnTo=%2Forders", label: "New Order", detail: "Create a sale", icon: Plus, type: "Action" },
  { href: "/inventory", label: "Adjust Inventory", detail: "Record a stock change", icon: Boxes, type: "Action" },
  { href: "/customers", label: "Add Customer", detail: "Create or edit CRM record", icon: Users, type: "Action" }
];

function roleLabel(user: SessionUser | null) {
  return user ? "Owner" : "Signed out";
}

type ShellPulse = {
  revenueTodayCents: number;
  ordersToday: number;
  lowStockCount: number;
  unitsToday: number;
};

const emptyPulse: ShellPulse = {
  revenueTodayCents: 0,
  ordersToday: 0,
  lowStockCount: 0,
  unitsToday: 0
};

export function AppShell({ children, currentUser }: { children: React.ReactNode; currentUser: SessionUser | null }) {
  const pathname = usePathname();
  const [pulse, setPulse] = useState<ShellPulse>(emptyPulse);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isLogin = pathname === "/login";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const newOrderHref = `/orders/new?returnTo=${encodeURIComponent(pathname)}`;
  const currentRole = roleLabel(currentUser);
  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return commandItems.filter((item) => !normalized || `${item.label} ${item.detail} ${item.type}`.toLowerCase().includes(normalized)).slice(0, 8);
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function loadPulse() {
      const response = await fetch("/api/shell-pulse", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json().catch(() => null);
      if (!cancelled && payload?.pulse) setPulse(payload.pulse);
    }

    void loadPulse();
    return () => {
      cancelled = true;
    };
  }, [currentUser, pathname]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (isLogin) {
    return <main>{children}</main>;
  }

  return (
    <div className="min-h-screen text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-[#111317] px-4 py-5 text-white lg:block">
        <Link href="/" className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white text-slate-950 shadow-sm">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">HappyTides Ops</div>
            <div className="text-xs text-slate-400">Wholesale operating system</div>
          </div>
        </Link>
        <nav className="mt-7 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white",
                  active && "bg-white text-slate-950 shadow-sm hover:bg-white hover:text-slate-950"
                )}
              >
                <Icon className={cn("text-slate-500 transition-colors group-hover:text-white", active && "text-slate-950 group-hover:text-slate-950")} size={17} />
                <span>
                  <span className="block leading-4">{item.label}</span>
                  <span className={cn("block text-[11px] font-normal text-slate-500", active && "text-slate-500")}>{item.detail}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account access</div>
          <div className="mt-1 text-sm font-semibold text-white">{currentRole}</div>
          <div className="mt-1 truncate text-xs leading-5 text-slate-400">{currentUser?.email ?? "Signed out"}</div>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.06] text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-950 text-white shadow-sm backdrop-blur lg:bg-white/90 lg:text-slate-950">
          <div className="flex h-12 items-center justify-between px-3 lg:hidden">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-950">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">HappyTides</div>
                <div className="truncate text-[11px] text-slate-400">Ops command center</div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <div className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-slate-300">{currentRole}</div>
              <button
                type="button"
                aria-label="Open navigation"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.08] text-white transition-colors hover:bg-white/[0.14] focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <Menu size={18} />
              </button>
            </div>
          </div>
          <div className="flex h-14 items-center gap-2 bg-white px-3 text-slate-950 sm:px-4 lg:h-16 lg:gap-3 lg:bg-transparent lg:px-8">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50/80 px-3 pl-9 text-left text-sm text-slate-500 shadow-none transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <span>Search or run a command</span>
                <span className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 sm:inline">⌘K</span>
              </button>
            </div>
            <Link
              href={newOrderHref}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto sm:px-3"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New order</span>
            </Link>
          </div>
          <div className="hidden border-t border-slate-200/70 bg-white/80 px-8 py-2 text-slate-950 lg:block">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <div className="inline-flex h-8 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800">
                <DollarSign size={14} />
                {formatCurrency(pulse.revenueTodayCents, 0)} today
              </div>
              <div className="inline-flex h-8 items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800">
                <ClipboardList size={14} />
                {formatNumber(pulse.ordersToday)} orders
              </div>
              <div className="inline-flex h-8 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800">
                <Activity size={14} />
                {formatNumber(pulse.unitsToday)} units moved
              </div>
              <div className={cn(
                "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold",
                pulse.lowStockCount > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"
              )}>
                <Boxes size={14} />
                {formatNumber(pulse.lowStockCount)} stock alerts
              </div>
            </div>
          </div>
        </header>
        {commandOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/35 px-3 pt-20 backdrop-blur-sm" role="presentation" onClick={() => setCommandOpen(false)}>
            <div className="mx-auto max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(event) => event.stopPropagation()}>
              <div className="relative border-b border-slate-200">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <Input autoFocus className="h-12 border-0 bg-white pl-11 shadow-none focus:ring-0" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and actions" />
              </div>
              <div className="max-h-96 overflow-y-auto p-2">
                {filteredCommands.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={`${item.type}-${item.href}-${item.label}`} href={item.href} onClick={() => setCommandOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors hover:bg-slate-50">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700"><Icon size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-950">{item.label}</span>
                        <span className="block truncate text-xs text-slate-500">{item.detail}</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">{item.type}</span>
                    </Link>
                  );
                })}
                {filteredCommands.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No matching commands.</div> : null}
              </div>
            </div>
          </div>
        ) : null}
        {mobileMenuOpen ? (
          <div
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
            role="presentation"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="absolute right-3 top-3 w-[min(350px,calc(100vw-24px))] rounded-lg border border-slate-200 bg-white p-3 text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-white">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">HappyTides</div>
                    <div className="text-[11px] text-slate-500">Navigation</div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close navigation"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="mt-3 grid grid-cols-2 gap-2">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50",
                        active && "border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-900"
                      )}
                    >
                      <Icon size={16} />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <Link
                href={newOrderHref}
                onClick={() => setMobileMenuOpen(false)}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Plus size={16} />
                New order
              </Link>
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">Signed in</div>
                <div className="mt-1 truncate text-sm font-semibold text-slate-950">{currentUser?.name ?? "N/A"}</div>
                <div className="truncate text-xs text-slate-500">{currentUser?.email ?? "N/A"}</div>
                <button
                  type="button"
                  onClick={signOut}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <main className="mx-auto max-w-[1500px] px-3 py-5 pb-6 sm:px-6 lg:px-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
