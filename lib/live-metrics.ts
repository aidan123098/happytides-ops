import type { Customer, InventoryBatch, Order, Product, RevenuePoint } from "@/types/domain";

type MetricsStore = {
  customers: Customer[];
  inventoryBatches: InventoryBatch[];
  orders: Order[];
  products: Product[];
};

function visibleOrders(orders: Order[]) {
  return orders.filter((order) => order.orderNumber !== "N/A" && order.paymentStatus !== "canceled" && order.fulfillmentStatus !== "canceled");
}

function paidOrders(orders: Order[]) {
  return visibleOrders(orders).filter((order) => order.paymentStatus === "paid");
}

function orderDate(order: Order) {
  const date = new Date(order.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(left: Date, right: Date) {
  return dateKey(left) === dateKey(right);
}

function isInLastDays(date: Date, days: number, now = new Date()) {
  const start = startOfDay(now);
  start.setDate(start.getDate() - (days - 1));
  return date >= start && date <= now;
}

function unitsInOrder(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function productForItem(products: Product[], item: Order["items"][number]) {
  if (item.productId) {
    return products.find((product) => product.id === item.productId);
  }

  return products.find((product) => product.name === item.productName);
}

function customerNameFromOrder(order: Order) {
  const name = order.customerName.trim();
  const fromNotes = order.notes?.match(/Customer:\s*([^|]+)/)?.[1]?.trim();
  return name && name !== "N/A" ? name : fromNotes || "N/A";
}

function customerFromGroup(name: string, orders: Order[]): Customer {
  const [firstName, ...lastNameParts] = name.split(" ");
  const totalSpendCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const orderCount = orders.length;
  const sorted = [...orders].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const productCounts = new Map<string, number>();

  for (const order of orders) {
    for (const item of order.items) {
      productCounts.set(item.productName, (productCounts.get(item.productName) ?? 0) + item.quantity);
    }
  }

  const favoriteProduct = [...productCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

  return {
    id: `customer_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "na"}`,
    firstName: firstName || "N/A",
    lastName: lastNameParts.join(" "),
    email: "N/A",
    phone: "N/A",
    customerType: "consumer",
    smsConsent: false,
    emailConsent: false,
    firstPurchaseAt: sorted[0]?.createdAt ?? "N/A",
    lastPurchaseAt: sorted[sorted.length - 1]?.createdAt ?? "N/A",
    totalSpendCents,
    orderCount,
    averageOrderValueCents: Math.round(totalSpendCents / Math.max(orderCount, 1)),
    favoriteProduct,
    notes: "N/A",
    tags: [],
    source: "walk-in",
    status: orderCount > 2 ? "VIP" : orderCount > 1 ? "returning" : "new"
  };
}

export function getProductsWithSales(store: MetricsStore) {
  const paid = paidOrders(store.orders);
  const now = new Date();

  return store.products.map((product) => {
    let unitsSoldToday = 0;
    let unitsSoldWeek = 0;
    let revenueWeekCents = 0;

    for (const order of paid) {
      const date = orderDate(order);
      if (!date) continue;

      for (const item of order.items) {
        const matchesProduct = item.productId === product.id || (!item.productId && item.productName === product.name);
        if (!matchesProduct) continue;

        if (isSameDay(date, now)) {
          unitsSoldToday += item.quantity;
        }

        if (isInLastDays(date, 7, now)) {
          unitsSoldWeek += item.quantity;
          revenueWeekCents += item.unitPriceCents * item.quantity;
        }
      }
    }

    return {
      ...product,
      unitsSoldToday,
      unitsSoldWeek,
      revenueWeekCents,
      marginPercent: product.priceCents > 0 ? ((product.priceCents - product.costOfGoodsCents) / product.priceCents) * 100 : 0
    };
  });
}

export function getRevenueSeries(orders: Order[]): RevenuePoint[] {
  const paid = paidOrders(orders);
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(now);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });

  return days.map((date) => {
    const dayOrders = paid.filter((order) => {
      const parsed = orderDate(order);
      return parsed ? isSameDay(parsed, date) : false;
    });

    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: dayOrders.reduce((sum, order) => sum + order.totalCents, 0) / 100,
      orders: dayOrders.length,
      units: dayOrders.reduce((sum, order) => sum + unitsInOrder(order), 0)
    };
  });
}

export function getLocationSales(orders: Order[]) {
  const grouped = new Map<string, { revenue: number; orders: number }>();

  for (const order of paidOrders(orders)) {
    const key = order.location || "Manual entry";
    const current = grouped.get(key) ?? { revenue: 0, orders: 0 };
    current.revenue += order.totalCents / 100;
    current.orders += 1;
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function getDerivedCustomers(store: MetricsStore) {
  const namedOrders = paidOrders(store.orders).filter((order) => customerNameFromOrder(order) !== "N/A");
  const grouped = new Map<string, Order[]>();

  for (const order of namedOrders) {
    const name = customerNameFromOrder(order);
    grouped.set(name, [...(grouped.get(name) ?? []), order]);
  }

  const derived = [...grouped.entries()].map(([name, orders]) => customerFromGroup(name, orders));
  const existing = store.customers.filter((customer) => customer.firstName !== "N/A" || customer.totalSpendCents > 0);

  return [...derived, ...existing].sort((a, b) => b.totalSpendCents - a.totalSpendCents);
}

export function getDashboardData(store: MetricsStore) {
  const paid = paidOrders(store.orders);
  const products = getProductsWithSales(store);
  const revenueSeries = getRevenueSeries(store.orders);
  const locationSales = getLocationSales(store.orders);
  const now = new Date();
  const todayOrders = paid.filter((order) => {
    const date = orderDate(order);
    return date ? isSameDay(date, now) : false;
  });
  const weekOrders = paid.filter((order) => {
    const date = orderDate(order);
    return date ? isInLastDays(date, 7, now) : false;
  });
  const monthOrders = paid.filter((order) => {
    const date = orderDate(order);
    return date ? date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() : false;
  });
  const derivedCustomers = getDerivedCustomers(store);
  const returningCustomers = derivedCustomers.filter((customer) => customer.orderCount > 1).length;
  const newCustomers = derivedCustomers.filter((customer) => customer.orderCount === 1).length;
  const revenueToday = todayOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const orderCountToday = todayOrders.length;
  const topToday = [...products].sort((a, b) => b.unitsSoldToday - a.unitsSoldToday)[0] ?? products[0];
  const topWeek = [...products].sort((a, b) => b.unitsSoldWeek - a.unitsSoldWeek)[0] ?? products[0];

  return {
    metrics: {
      revenueToday,
      revenueWeek: weekOrders.reduce((sum, order) => sum + order.totalCents, 0),
      revenueMonth: monthOrders.reduce((sum, order) => sum + order.totalCents, 0),
      aov: Math.round(revenueToday / Math.max(orderCountToday, 1)),
      orderCountToday,
      unitsSoldToday: todayOrders.reduce((sum, order) => sum + unitsInOrder(order), 0),
      topToday,
      topWeek,
      lowStock: store.inventoryBatches.filter((batch) => batch.reorderThreshold !== null && batch.quantityOnHand <= batch.reorderThreshold),
      repeatRate: derivedCustomers.length ? Math.round((returningCustomers / derivedCustomers.length) * 100) : 0,
      newCustomers,
      returningCustomers
    },
    products,
    revenueSeries,
    locationSales,
    recentOrders: visibleOrders(store.orders)
  };
}

export function getAnalyticsSummaryFromStore(store: MetricsStore) {
  const paid = paidOrders(store.orders);
  const dashboard = getDashboardData(store);
  const grossMarginCents = paid.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => {
      const product = productForItem(store.products, item);
      return itemSum + (item.unitPriceCents - (product?.costOfGoodsCents ?? 0)) * item.quantity;
    }, 0);
  }, 0);
  const derivedCustomers = getDerivedCustomers(store);
  const purchaseDates = paid.map(orderDate).filter((date): date is Date => Boolean(date)).sort((a, b) => a.getTime() - b.getTime());
  const daysBetween =
    purchaseDates.length > 1
      ? Math.round(
          purchaseDates.slice(1).reduce((sum, date, index) => {
            return sum + (date.getTime() - purchaseDates[index].getTime()) / (1000 * 60 * 60 * 24);
          }, 0) / (purchaseDates.length - 1)
        )
      : 0;

  return {
    revenueCents: paid.reduce((sum, order) => sum + order.totalCents, 0),
    netRevenueCents: paid.reduce((sum, order) => sum + order.totalCents, 0),
    grossMarginCents,
    unitsSold: paid.reduce((sum, order) => sum + unitsInOrder(order), 0),
    revenueTodayCents: dashboard.metrics.revenueToday,
    revenueWeekCents: dashboard.metrics.revenueWeek,
    revenueMonthCents: dashboard.metrics.revenueMonth,
    ordersToday: dashboard.metrics.orderCountToday,
    ordersWeek: dashboard.recentOrders.filter((order) => {
      const date = orderDate(order);
      return date ? isInLastDays(date, 7) : false;
    }).length,
    unitsToday: dashboard.metrics.unitsSoldToday,
    unitsWeek: dashboard.products.reduce((sum, product) => sum + product.unitsSoldWeek, 0),
    aovTodayCents: dashboard.metrics.aov,
    topToday: dashboard.metrics.topToday,
    topWeek: dashboard.metrics.topWeek,
    activeCustomers: derivedCustomers.filter((customer) => customer.orderCount > 0).length,
    repeatPurchaseRate: dashboard.metrics.repeatRate,
    averageDaysBetweenPurchases: daysBetween,
    dormantCustomers: derivedCustomers.filter((customer) => customer.status === "inactive"),
    topCustomers: derivedCustomers.slice(0, 5),
    lowStock: dashboard.metrics.lowStock,
    expiringSoon: store.inventoryBatches.filter((batch) => {
      const date = new Date(batch.expirationDate);
      return !Number.isNaN(date.getTime()) && date < new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
    }),
    revenueSeries: dashboard.revenueSeries,
    products: dashboard.products,
    locationSales: dashboard.locationSales,
    recentOrders: dashboard.recentOrders.slice(0, 8)
  };
}
