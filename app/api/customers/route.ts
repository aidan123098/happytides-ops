import { NextResponse } from "next/server";
import { CustomerSource, CustomerStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { getLocalStore } from "@/lib/local-store";
import { isDatabaseUnavailable } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { customerInputSchema, customerUpdateSchema } from "@/lib/validation";

const sourceMap = {
  "walk-in": CustomerSource.WALK_IN,
  referral: CustomerSource.REFERRAL,
  event: CustomerSource.EVENT,
  Instagram: CustomerSource.INSTAGRAM,
  website: CustomerSource.WEBSITE,
  other: CustomerSource.OTHER
} as const;

const statusMap = {
  new: CustomerStatus.NEW,
  returning: CustomerStatus.RETURNING,
  VIP: CustomerStatus.VIP,
  inactive: CustomerStatus.INACTIVE
} as const;

function validationError(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error.issues as Array<{ path: Array<string | number>; message: string }>) : [];
  const detail = issues[0] ? `${issues[0].path.join(".")}: ${issues[0].message}` : "Check the required fields and try again.";
  return NextResponse.json({ error: detail }, { status: 400 });
}

async function domainCustomer(id: string) {
  return (await getLocalStore()).customers.find((customer) => customer.id === id);
}

export async function GET() {
  await requirePermission("customers:read");
  return NextResponse.json({ customers: (await getLocalStore()).customers });
}

export async function POST(request: Request) {
  const actor = await requirePermission("customers:manage");
  const parsed = customerInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;
  try {
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email === "N/A" ? null : payload.email,
          phone: payload.phone === "N/A" ? null : payload.phone,
          smsConsent: payload.smsConsent,
          emailConsent: payload.emailConsent,
          source: sourceMap[payload.source],
          status: statusMap[payload.status ?? "new"],
          notes: payload.notes
        }
      });

      await writeAuditLog({ actor, entityType: "CUSTOMER", entityId: created.id, action: "CREATE", after: created, request }, tx);
      return created;
    });

    return NextResponse.json({ customer: await domainCustomer(customer.id) }, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "The shared database is unavailable, so the customer was not saved. Try again in a moment." }, { status: 503 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Customer could not be saved." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const actor = await requirePermission("customers:manage");
  const parsed = customerUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payload = parsed.data;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.customer.findUnique({ where: { id: payload.customerId } });

      if (!before || before.archivedAt) {
        return null;
      }

      const after = await tx.customer.update({
        where: { id: payload.customerId },
        data: {
          firstName: payload.firstName ?? before.firstName,
          lastName: payload.lastName ?? before.lastName,
          email: payload.email === undefined ? before.email : payload.email === "N/A" ? null : payload.email,
          phone: payload.phone === undefined ? before.phone : payload.phone === "N/A" ? null : payload.phone,
          smsConsent: payload.smsConsent ?? before.smsConsent,
          emailConsent: payload.emailConsent ?? before.emailConsent,
          source: payload.source ? sourceMap[payload.source] : before.source,
          status: payload.status ? statusMap[payload.status] : before.status,
          notes: payload.notes ?? before.notes
        }
      });

      await writeAuditLog({ actor, entityType: "CUSTOMER", entityId: after.id, action: "UPDATE", before, after, request }, tx);
      return after;
    });

    if (!updated) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ customer: await domainCustomer(updated.id) });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "The shared database is unavailable, so the customer was not updated. Try again in a moment." }, { status: 503 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Customer could not be updated." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const actor = await requirePermission("customers:manage");
  const customerId = new URL(request.url).searchParams.get("customerId");

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  try {
    const archived = await prisma.$transaction(async (tx) => {
      const before = await tx.customer.findUnique({ where: { id: customerId } });
      if (!before || before.archivedAt) return null;
      const after = await tx.customer.update({ where: { id: customerId }, data: { archivedAt: new Date() } });
      await writeAuditLog({ actor, entityType: "CUSTOMER", entityId: customerId, action: "ARCHIVE", before, after, request }, tx);
      return after;
    });

    if (!archived) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: "The shared database is unavailable, so the customer was not removed. Try again in a moment." }, { status: 503 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Customer could not be removed." }, { status: 400 });
  }
}
