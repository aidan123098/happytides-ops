import type { Product } from "@/types/domain";

const skuAliases: Record<string, string> = {
  BC10: "BPC",
  BT10: "TB-500",
  CND10: "CJC",
  TSM10: "TESA",
  CU50: "GHK-Cu",
  MS10: "MOTS-C",
  RT10: "GLP",
  NJ500: "NAD+",
  BBG70: "GLOW",
  KL80: "KLOW",
  BAC30: "BAC"
};

export function productOptionLabel(product: Product) {
  const nameIncludesStrength = product.name.toLowerCase().includes(product.strengthLabel.toLowerCase());
  const name = nameIncludesStrength ? product.name : `${product.name} ${product.strengthLabel}`;
  return `${skuAliases[product.sku] ?? product.sku} - ${name} (${product.sku})`;
}
