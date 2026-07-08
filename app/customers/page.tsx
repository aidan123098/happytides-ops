import Link from "next/link";
import { DollarSign, MessageCircle, Repeat2, Store, UserPlus, UsersRound } from "lucide-react";
import { CustomersWorkbench } from "@/components/customers-workbench";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomers } from "@/lib/services/operational-data";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function isRealCustomer(customer: { id: string; firstName: string; email: string; phone: string }) {
  return customer.id !== "cust_placeholder" && (customer.firstName !== "N/A" || customer.email !== "N/A" || customer.phone !== "N/A");
}

export default async function CustomersPage() {
  const customers = await getCustomers();
  const realCustomers = customers.filter(isRealCustomer);
  const repeatCustomers = realCustomers.filter((customer) => customer.orderCount > 1).length;
  const consentReady = realCustomers.filter((customer) => customer.smsConsent || customer.emailConsent).length;
  const wholesaleCustomers = realCustomers.filter((customer) => customer.customerType === "wholesaler").length;
  const topCustomers = [...realCustomers].sort((left, right) => right.totalSpendCents - left.totalSpendCents).slice(0, 4);
  const followUpQueue = [...realCustomers]
    .filter((customer) => customer.orderCount > 0 || (!customer.smsConsent && !customer.emailConsent))
    .sort((left, right) => Number(!right.smsConsent && !right.emailConsent) - Number(!left.smsConsent && !left.emailConsent) || right.totalSpendCents - left.totalSpendCents)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        description="Keep customer contact details, order history, consent, and follow-up notes in one place."
        icon={UsersRound}
        kicker={`${formatNumber(realCustomers.length)} real records`}
        stats={[
          { label: "Repeat buyers", value: formatNumber(repeatCustomers), detail: "Customers with more than one order", icon: Repeat2, tone: repeatCustomers > 0 ? "blue" : "slate" },
          { label: "Consent ready", value: formatNumber(consentReady), detail: "SMS or email allowed", icon: MessageCircle, tone: consentReady > 0 ? "blue" : "amber" },
          { label: "Wholesale", value: formatNumber(wholesaleCustomers), detail: "Wholesale customer records", icon: Store, tone: wholesaleCustomers > 0 ? "amber" : "slate" }
        ]}
        actions={
          <>
            <Link
              href="#customers-workbench"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <UsersRound size={16} />
              See customers
            </Link>
            <Link
              href="/customers/new"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <UserPlus size={16} />
              Add customer
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Customers" value={formatNumber(realCustomers.length)} detail={`${formatNumber(repeatCustomers)} repeat buyers`} icon={UsersRound} tone="blue" />
        <MetricCard title="Consent Ready" value={formatNumber(consentReady)} detail="SMS or email allowed" icon={MessageCircle} tone={consentReady > 0 ? "blue" : "amber"} />
        <MetricCard title="Wholesale" value={formatNumber(wholesaleCustomers)} detail="Wholesale customer records" icon={Store} tone="amber" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign size={17} className="text-blue-700" />
              <CardTitle>Top customer value</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCustomers.map((customer, index) => (
              <div key={customer.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-sm font-semibold text-slate-700 shadow-sm">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{customer.firstName} {customer.lastName}</div>
                    <div className="text-xs text-slate-500">{customer.favoriteProduct}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-950">{formatCurrency(customer.totalSpendCents)}</div>
                  <div className="text-xs text-slate-500">{formatNumber(customer.orderCount)} orders</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Repeat2 size={17} className="text-blue-700" />
              <CardTitle>Follow-up queue</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUpQueue.map((customer) => (
              <div key={customer.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{customer.firstName} {customer.lastName}</div>
                    <div className="text-xs text-slate-500">Last purchase {customer.lastPurchaseAt}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge tone={customer.status === "returning" ? "blue" : "slate"}>{customer.status}</Badge>
                    {!customer.smsConsent && !customer.emailConsent ? <Badge tone="amber">No consent</Badge> : null}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">{customer.notes}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div id="customers-workbench">
        <CustomersWorkbench customers={customers} />
      </div>
    </div>
  );
}
