import Link from "next/link";
import { BadgeDollarSign, Clock3, HandCoins, Handshake, Plus, WalletCards } from "lucide-react";
import { AffiliatesWorkbench } from "@/components/affiliates-workbench";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { getAffiliates } from "@/lib/services/operational-data";
import { formatCurrency, formatCurrencyOrNA, formatNumber, formatNumberOrNA } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage() {
  const affiliates = await getAffiliates();
  const revenueGeneratedCents = affiliates.reduce((sum, affiliate) => sum + (affiliate.revenueGeneratedCents ?? 0), 0);
  const payoutDueCents = affiliates.reduce((sum, affiliate) => sum + (affiliate.payoutDueCents ?? 0), 0);
  const totalPayoutCents = affiliates.reduce((sum, affiliate) => sum + (affiliate.totalPayoutCents ?? 0), 0);
  const referredOrders = affiliates.reduce((sum, affiliate) => sum + (affiliate.referredOrders ?? 0), 0);
  const activeAffiliates = affiliates.filter((affiliate) => affiliate.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Affiliate operations"
        title="Referral payout ledger"
        description="Referral controls for affiliate codes, status, attributed revenue, commission rates, payout due, payment history, and partner performance."
        icon={Handshake}
        kicker={`${formatNumber(activeAffiliates)} active partners`}
        stats={[
          { label: "Affiliate revenue", value: formatCurrency(revenueGeneratedCents, 0), detail: "Revenue attributed to referral partners", icon: BadgeDollarSign, tone: "blue" },
          { label: "Payout due", value: formatCurrency(payoutDueCents, 0), detail: "Outstanding affiliate payable", icon: WalletCards, tone: payoutDueCents > 0 ? "amber" : "green" },
          { label: "Total paid", value: formatCurrency(totalPayoutCents, 0), detail: "Lifetime partner payouts recorded", icon: HandCoins, tone: "green" },
          { label: "Referred orders", value: formatNumber(referredOrders), detail: "Orders tied to affiliate codes", icon: Clock3, tone: referredOrders > 0 ? "blue" : "slate" }
        ]}
        actions={
          <Link
            href="#affiliates-workbench"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Plus size={16} />
            Manage affiliates
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Affiliate revenue" value={formatCurrencyOrNA(revenueGeneratedCents)} detail="Revenue attributed to affiliates" icon={BadgeDollarSign} tone="blue" />
        <MetricCard title="Payout due" value={formatCurrencyOrNA(payoutDueCents)} detail="Outstanding affiliate payable" icon={WalletCards} tone="amber" />
        <MetricCard title="Total paid" value={formatCurrencyOrNA(totalPayoutCents)} detail="Lifetime affiliate payouts" icon={HandCoins} tone="green" />
        <MetricCard title="Referred orders" value={formatNumberOrNA(referredOrders)} detail="Orders tied to affiliate codes" icon={Clock3} tone="slate" />
      </section>

      <div id="affiliates-workbench">
        <AffiliatesWorkbench affiliates={affiliates} />
      </div>
    </div>
  );
}
