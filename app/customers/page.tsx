import { CustomersWorkbench } from "@/components/customers-workbench";
import { getLocalStore } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { customers } = await getLocalStore();

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">CRM</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Customers</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Privacy-conscious customer records for receipts, consent, customer type, spend, repeat purchase signals, and notes.
          </p>
        </div>
      </section>

      <CustomersWorkbench customers={customers} />
    </div>
  );
}
