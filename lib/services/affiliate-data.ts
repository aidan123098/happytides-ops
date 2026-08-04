import { prisma } from "@/lib/prisma";
import { canonicalAffiliateStatus, displayAffiliateCode } from "@/lib/affiliate-rules";
import { orderStageFromPersistence } from "@/lib/order-stage";
import type {
  Affiliate,
  AffiliateCommissionDetail,
  AffiliateDetail,
  AffiliatePayoutDetail,
  AffiliateProgram
} from "@/types/domain";

type AffiliateRow = {
  id: string;
  name: string | null;
  code: string | null;
  affiliateType: string;
  status: string;
  revenueGeneratedCents: number;
  payoutRateBps: number;
  totalPayoutCents: number;
  payoutDueCents: number;
  referredCustomers: number;
  referredOrders: number;
  lastPayoutAt: Date | null;
  notes: string | null;
  archivedAt: Date | null;
  websiteUserId: string | null;
  websiteCustomerId: string | null;
  websiteName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
};

type CommissionResponse = {
  items?: Array<{
    commissionId?: string;
    orderId?: string;
    orderNumber?: string;
    customerName?: string;
    commissionType?: string;
    rateBps?: number;
    commissionableCents?: number;
    amountCents?: number;
    reversedCents?: number;
    netCents?: number;
    status?: string;
    earnedAt?: string;
    eligibleAt?: string | null;
    refunds?: Array<{
      refundId?: string;
      externalReference?: string;
      refundedMerchandiseCents?: number;
      reversedCommissionCents?: number;
      createdAt?: string;
    }>;
  }>;
};

function isoOrNA(date: Date | null | undefined) {
  return date ? date.toISOString() : "N/A";
}

function affiliateFromRow(row: AffiliateRow): Affiliate {
  const websiteName = row.websiteName?.trim();
  return {
    id: row.id,
    name: websiteName || row.name || "N/A",
    code: displayAffiliateCode(row.code),
    affiliateType: ["online", "wholesale", "influencer"].includes(row.affiliateType)
      ? row.affiliateType as Affiliate["affiliateType"]
      : "online",
    source: row.websiteUserId ? "website" : "staff",
    status: canonicalAffiliateStatus(row.status, row.archivedAt),
    contactEmail: row.contactEmail || undefined,
    contactPhone: row.contactPhone || undefined,
    submittedAt: isoOrNA(row.submittedAt),
    approvedAt: isoOrNA(row.approvedAt),
    revenueGeneratedCents: row.revenueGeneratedCents,
    payoutRatePercent: row.payoutRateBps / 100,
    totalPayoutCents: row.totalPayoutCents,
    payoutDueCents: row.payoutDueCents,
    referredCustomers: row.referredCustomers,
    referredOrders: row.referredOrders,
    lastPayoutAt: isoOrNA(row.lastPayoutAt),
    notes: row.notes ?? "N/A"
  };
}

async function affiliateRows(includeArchived: boolean) {
  return prisma.$queryRaw<AffiliateRow[]>`
    SELECT
      a.id,
      a.name,
      a.code,
      a.affiliate_type AS "affiliateType",
      a.status,
      a.revenue_generated_cents AS "revenueGeneratedCents",
      a.payout_rate_bps AS "payoutRateBps",
      a.total_payout_cents AS "totalPayoutCents",
      a.payout_due_cents AS "payoutDueCents",
      a.referred_customers AS "referredCustomers",
      a.referred_orders AS "referredOrders",
      a.last_payout_at AS "lastPayoutAt",
      a.notes,
      a.archived_at AS "archivedAt",
      aa.user_id::text AS "websiteUserId",
      ca.customer_id AS "websiteCustomerId",
      nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '') AS "websiteName",
      coalesce(nullif(c.email, ''), nullif(ca.claim_email, '')) AS "contactEmail",
      nullif(c.phone, '') AS "contactPhone",
      aa.submitted_at AS "submittedAt",
      aa.approved_at AS "approvedAt"
    FROM public.affiliates a
    LEFT JOIN storefront.affiliate_accounts aa ON aa.affiliate_id = a.id
    LEFT JOIN storefront.customer_accounts ca ON ca.user_id = aa.user_id
    LEFT JOIN public.customers c ON c.id = ca.customer_id AND c.archived_at IS NULL
    WHERE (${includeArchived}::boolean OR a.archived_at IS NULL)
    ORDER BY a.updated_at DESC
  `;
}

export async function loadAffiliates(options: { includeArchived?: boolean } = {}) {
  return (await affiliateRows(options.includeArchived ?? false)).map(affiliateFromRow);
}

export async function loadAffiliateById(id: string) {
  const rows = await affiliateRows(true);
  const row = rows.find((affiliate) => affiliate.id === id);
  return row ? affiliateFromRow(row) : undefined;
}

function commissionItems(value: unknown): AffiliateCommissionDetail[] {
  const response = value && typeof value === "object" ? value as CommissionResponse : {};
  return (response.items ?? []).map((commission) => ({
    id: commission.commissionId ?? "",
    orderId: commission.orderId ?? "",
    orderNumber: commission.orderNumber ?? "N/A",
    customerName: commission.customerName ?? "N/A",
    commissionType: commission.commissionType === "repeat" ? "repeat" : "first_order",
    rateBps: commission.rateBps ?? 0,
    commissionableCents: commission.commissionableCents ?? 0,
    amountCents: commission.amountCents ?? 0,
    reversedCents: commission.reversedCents ?? 0,
    netCents: commission.netCents ?? 0,
    status: ["approved", "paid", "reversed"].includes(commission.status ?? "")
      ? commission.status as AffiliateCommissionDetail["status"]
      : "pending",
    earnedAt: commission.earnedAt ?? "N/A",
    eligibleAt: commission.eligibleAt ?? undefined,
    refunds: (commission.refunds ?? []).map((refund) => ({
      id: refund.refundId ?? "",
      externalReference: refund.externalReference ?? "N/A",
      refundedMerchandiseCents: refund.refundedMerchandiseCents ?? 0,
      reversedCommissionCents: refund.reversedCommissionCents ?? 0,
      createdAt: refund.createdAt ?? "N/A"
    }))
  }));
}

export async function loadAffiliateDetail(id: string): Promise<AffiliateDetail | undefined> {
  const affiliate = await prisma.affiliate.findUnique({ where: { id }, select: { id: true } });
  if (!affiliate) return undefined;

  const [orders, activity, commissionResult, payouts] = await Promise.all([
    prisma.order.findMany({
      where: { affiliateId: id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        subtotalCents: true,
        discountCents: true,
        fulfillmentStatus: true,
        paymentStatus: true,
        status: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } }
      }
    }),
    prisma.auditLog.findMany({
      where: { entityType: "AFFILIATE", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, displayName: true } }
      }
    }),
    prisma.$queryRaw<Array<{ payload: unknown }>>`
      SELECT public.admin_storefront_commissions(${id}, NULL, 100, NULL) AS payload
    `,
    prisma.$queryRaw<Array<{
      id: string;
      periodStart: string;
      periodEnd: string;
      amountCents: number;
      status: string;
      externalReference: string | null;
      approvedAt: string | null;
      paidAt: string | null;
      createdAt: string;
    }>>`
      SELECT
        p.id::text,
        p.period_start::text AS "periodStart",
        p.period_end::text AS "periodEnd",
        p.amount_cents AS "amountCents",
        p.status,
        p.external_reference AS "externalReference",
        p.approved_at::text AS "approvedAt",
        p.paid_at::text AS "paidAt",
        p.created_at::text AS "createdAt"
      FROM storefront.affiliate_payouts p
      WHERE p.affiliate_id = ${id}
      ORDER BY p.period_end DESC, p.created_at DESC
      LIMIT 50
    `
  ]);

  return {
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      status: orderStageFromPersistence(order),
      productNetCents: Math.max(order.subtotalCents - order.discountCents, 0),
      createdAt: order.createdAt.toISOString()
    })),
    commissions: commissionItems(commissionResult[0]?.payload),
    payouts: payouts.map((payout): AffiliatePayoutDetail => ({
      id: payout.id,
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      amountCents: payout.amountCents,
      status: ["approved", "paid", "cancelled"].includes(payout.status)
        ? payout.status as AffiliatePayoutDetail["status"]
        : "draft",
      externalReference: payout.externalReference ?? undefined,
      approvedAt: payout.approvedAt ?? undefined,
      paidAt: payout.paidAt ?? undefined,
      createdAt: payout.createdAt
    })),
    activity: activity.map((entry) => {
      const metadata = entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
        ? entry.metadata as Record<string, unknown>
        : {};
      const reason = typeof metadata.reason === "string" ? metadata.reason : undefined;
      const amountCents = typeof metadata.amountCents === "number" ? metadata.amountCents : undefined;
      return {
        id: entry.id,
        action: entry.action,
        actorName: entry.actor?.displayName || entry.actor?.name || "System",
        detail: reason || entry.action.toLowerCase().replaceAll("_", " "),
        amountCents,
        createdAt: entry.createdAt.toISOString()
      };
    })
  };
}

export async function loadAffiliateProgram(): Promise<AffiliateProgram> {
  const rows = await prisma.$queryRaw<Array<{
    active: boolean;
    shopperDiscountBps: number;
    firstOrderCommissionBps: number;
    repeatCommissionBps: number;
    attributionDays: number;
  }>>`
    SELECT
      active,
      shopper_discount_bps AS "shopperDiscountBps",
      first_order_commission_bps AS "firstOrderCommissionBps",
      repeat_commission_bps AS "repeatCommissionBps",
      attribution_days AS "attributionDays"
    FROM storefront.affiliate_program
    WHERE id = 'default'
  `;
  const row = rows[0];
  return {
    active: row?.active ?? false,
    shopperDiscountPercent: (row?.shopperDiscountBps ?? 0) / 100,
    firstOrderCommissionPercent: (row?.firstOrderCommissionBps ?? 0) / 100,
    repeatCommissionPercent: (row?.repeatCommissionBps ?? 0) / 100,
    attributionDays: row?.attributionDays ?? 30
  };
}
