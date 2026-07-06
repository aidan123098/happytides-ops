import { BadgeDollarSign, Clock3, HandCoins, WalletCards } from "lucide-react";
import { AffiliatesWorkbench } from "@/components/affiliates-workbench";
import { MetricCard } from "@/components/metric-card";
import { getLocalStore } from "@/lib/local-store";
import { formatCurrencyOrNA, formatNumberOrNA } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage() {
  const { affiliates } = await getLocalStore();
  const revenueGeneratedCents = affiliates.reduce((sum, affiliate) => sum + (affiliate.revenueGeneratedCents ?? 0), 0);
  const payoutDueCents = affiliates.reduce((sum, affiliate) => sum + (affiliate.payoutDueCents ?? 0), 0);
  const totalPayoutCents = affiliates.reduce((sum, affiliate) => sum + (affiliate.totalPayoutCents ?? 0), 0);
  const referredOrders = affiliates.reduce((sum, affiliate) => sum + (affiliate.referredOrders ?? 0), 0);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-700">Affiliate operations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Affiliates</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Track referral revenue, commission rates, payout due, payout history, affiliate codes, and performance attribution.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Affiliate revenue" value={formatCurrencyOrNA(revenueGeneratedCents)} detail="Revenue attributed to affiliates" icon={BadgeDollarSign} tone="blue" />
        <MetricCard title="Payout due" value={formatCurrencyOrNA(payoutDueCents)} detail="Outstanding affiliate payable" icon={WalletCards} tone="amber" />
        <MetricCard title="Total paid" value={formatCurrencyOrNA(totalPayoutCents)} detail="Lifetime affiliate payouts" icon={HandCoins} tone="green" />
        <MetricCard title="Referred orders" value={formatNumberOrNA(referredOrders)} detail="Orders tied to affiliate codes" icon={Clock3} tone="slate" />
      </section>

      <AffiliatesWorkbench affiliates={affiliates} />
    </div>
  );
}
