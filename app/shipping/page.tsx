import { AlertTriangle, PackageCheck, Truck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ShippingWorkbench } from "@/components/shipping-workbench";
import { getShippingConfig, getShippingQueue } from "@/lib/services/shipping";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const [orders, config] = await Promise.all([getShippingQueue(), getShippingConfig()]);
  const ready = orders.filter((order) => order.shippingAddress && (order.status === "paid" || order.status === "packed") && !order.shippingLabel).length;
  const inTransit = orders.filter((order) => order.status === "shipped" || order.shippingLabel?.status === "in_transit").length;
  const needsAddress = orders.filter((order) => !order.shippingAddress).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fulfillment"
        title="Shipping"
        description="Review addresses, compare carrier rates, print labels, and track delivery from one queue."
        icon={Truck}
        kicker={config.enabled ? "ShipStation enabled" : "Setup required"}
        stats={[
          { label: "Ready for label", value: formatNumber(ready), detail: "Paid or packed with an address", icon: PackageCheck, tone: ready ? "green" : "slate" },
          { label: "In transit", value: formatNumber(inTransit), detail: "Carrier movement recorded", icon: Truck, tone: inTransit ? "cyan" : "slate" },
          { label: "Address needed", value: formatNumber(needsAddress), detail: "Add before rate review", icon: AlertTriangle, tone: needsAddress ? "amber" : "green" }
        ]}
      />
      <ShippingWorkbench initialOrders={orders} initialConfig={config} />
    </div>
  );
}
