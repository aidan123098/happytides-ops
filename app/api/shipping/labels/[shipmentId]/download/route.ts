import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getShippingLabelPdf } from "@/lib/services/shipping";

export async function GET(_request: Request, context: { params: Promise<{ shipmentId: string }> }) {
  await requirePermission("orders:read");
  const { shipmentId } = await context.params;
  try {
    const pdf = await getShippingLabelPdf(shipmentId);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="HappyTides-Shipping-Label-${shipmentId}.pdf"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The label could not be downloaded." }, { status: 404 });
  }
}
