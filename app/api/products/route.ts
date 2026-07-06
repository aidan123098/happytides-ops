import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { getLocalStore } from "@/lib/local-store";
import { createOfflineProduct, isDatabaseUnavailable } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { productInputSchema } from "@/lib/validation";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  await requirePermission("dashboard:read");
  return NextResponse.json({ products: (await getLocalStore()).products });
}

export async function POST(request: Request) {
  const actor = await requirePermission("products:manage");
  const payload = productInputSchema.parse(await request.json());

  try {
    const product = await prisma.$transaction(async (tx) => {
      const category = await tx.productCategory.upsert({
        where: { name: payload.category },
        update: {},
        create: { name: payload.category }
      });
      const created = await tx.product.create({
        data: {
          name: payload.name,
          slug: slugify(payload.name),
          sku: payload.sku,
          categoryId: category.id,
          peptideType: payload.peptideType,
          strengthLabel: payload.strengthLabel,
          priceCents: payload.priceCents,
          costOfGoodsCents: payload.costOfGoodsCents,
          active: payload.active,
          colorAccent: payload.colorAccent,
          description: payload.description,
          coaUrl: payload.coaUrl,
          researchUseDisclaimer: payload.researchUseDisclaimer,
          imageUrl: payload.imageUrl,
          inventoryTrackingEnabled: payload.inventoryTrackingEnabled,
          wholesalePriceCents: payload.priceCents
        }
      });

      await writeAuditLog({ actor, entityType: "PRODUCT", entityId: created.id, action: "CREATE", after: created, request }, tx);
      return created;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    const product = createOfflineProduct({
      name: payload.name,
      sku: payload.sku,
      category: payload.category,
      peptideType: payload.peptideType,
      strengthLabel: payload.strengthLabel,
      priceCents: payload.priceCents,
      costOfGoodsCents: payload.costOfGoodsCents,
      active: payload.active,
      colorAccent: payload.colorAccent,
      description: payload.description ?? "",
      coaUrl: payload.coaUrl ?? "N/A",
      researchUseDisclaimer: payload.researchUseDisclaimer,
      imageUrl: payload.imageUrl ?? "",
      inventoryTrackingEnabled: payload.inventoryTrackingEnabled
    });
    return NextResponse.json({ product }, { status: 201 });
  }
}
