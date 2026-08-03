const SHOPIFY_ADMIN_ORDER_PREFIX = "https://admin.shopify.com/store/happy-tides-ikkkdaq4/orders/";

export function normalizeShopifyOrderId(value?: string | null) {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  if (/^\d+$/.test(candidate)) return candidate;

  const gidMatch = candidate.match(/^gid:\/\/shopify\/Order\/(\d+)$/i);
  if (gidMatch) return gidMatch[1];

  try {
    const url = new URL(candidate);
    const pathMatch = url.pathname.match(/^\/store\/happy-tides-ikkkdaq4\/orders\/(\d+)\/?$/i);
    if (url.protocol === "https:" && url.hostname === "admin.shopify.com" && pathMatch) return pathMatch[1];
  } catch {
    return undefined;
  }

  return undefined;
}

export function shopifyAdminOrderUrl(value?: string | null) {
  const orderId = normalizeShopifyOrderId(value);
  return orderId ? `${SHOPIFY_ADMIN_ORDER_PREFIX}${orderId}` : undefined;
}
