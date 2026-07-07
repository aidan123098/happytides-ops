import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { getLocalStore } from "@/lib/local-store";
import { createOfflineProduct, deleteOfflineProduct, isDatabaseUnavailable, updateOfflineProduct } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { productInputSchema, productUpdateSchema } from "@/lib/validation";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function validationError(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error.issues as Array<{ path: Array<string | number>; message: string }>) : [];
  const detail = issues[0] ? `${issues[0].path.join(".")}: ${issues[0].message}` : "Check the required fields and try again.";
  return NextResponse.json({ error: detail }, { status: 400 });
}

async function domainProduct(id: string) {
  return (await getLocalStore()).products.find((product) => product.id === id);
}

export async function GET() {
  await requirePermission("dashboard:read");
  return NextResponse.json({ products: (await getLocalStore()).products });
}

export async function POST(request: Request) {
  const actor = await requirePermission("products:manage");
  const parsed = productInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;

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

    return NextResponse.json({ product: await domainProduct(product.id) }, { status: 201 });
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

export async function PATCH(request: Request) {
  const actor = await requirePermission("products:manage");
  const parsed = productUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;
  const updated = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const before = await tx.product.findUnique({ where: { id: payload.productId } });

        if (!before || before.archivedAt) {
          return null;
        }

        const category = payload.category
          ? await tx.productCategory.upsert({
              where: { name: payload.category },
              update: {},
              create: { name: payload.category }
            })
          : null;

        const after = await tx.product.update({
          where: { id: payload.productId },
          data: {
            name: payload.name ?? before.name,
            slug: payload.name ? slugify(payload.name) : before.slug,
            sku: payload.sku ?? before.sku,
            categoryId: category?.id ?? before.categoryId,
            peptideType: payload.peptideType ?? before.peptideType,
            strengthLabel: payload.strengthLabel ?? before.strengthLabel,
            priceCents: payload.priceCents ?? before.priceCents,
            costOfGoodsCents: payload.costOfGoodsCents ?? before.costOfGoodsCents,
            active: payload.active ?? before.active,
            colorAccent: payload.colorAccent ?? before.colorAccent,
            description: payload.description ?? before.description,
            coaUrl: payload.coaUrl ?? before.coaUrl,
            researchUseDisclaimer: payload.researchUseDisclaimer ?? before.researchUseDisclaimer,
            imageUrl: payload.imageUrl ?? before.imageUrl,
            inventoryTrackingEnabled: payload.inventoryTrackingEnabled ?? before.inventoryTrackingEnabled,
            wholesalePriceCents: payload.priceCents ?? before.wholesalePriceCents
          }
        });

        await writeAuditLog({ actor, entityType: "PRODUCT", entityId: after.id, action: "UPDATE", before, after, request }, tx);
        return after;
      });
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      return updateOfflineProduct(payload.productId, {
        name: payload.name,
        sku: payload.sku,
        category: payload.category,
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
        inventoryTrackingEnabled: payload.inventoryTrackingEnabled
      });
    }
  })();

  if (!updated) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ product: await domainProduct(updated.id) });
}

export async function DELETE(request: Request) {
  const actor = await requirePermission("products:manage");
  const productId = new URL(request.url).searchParams.get("productId");

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const archived = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const before = await tx.product.findUnique({ where: { id: productId } });
        if (!before || before.archivedAt) return null;
        const after = await tx.product.update({ where: { id: productId }, data: { active: false, archivedAt: new Date() } });
        await writeAuditLog({ actor, entityType: "PRODUCT", entityId: productId, action: "ARCHIVE", before, after, request }, tx);
        return after;
      });
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      return deleteOfflineProduct(productId) ? { id: productId } : null;
    }
  })();

  if (!archived) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
