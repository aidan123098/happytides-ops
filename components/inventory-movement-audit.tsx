"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Boxes } from "lucide-react";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import type { InventoryMovement } from "@/types/domain";

type InventoryMovementAuditProps = {
  initialOrderMovements: InventoryMovement[];
  initialStockMovements: InventoryMovement[];
};

function movementTone(type: string) {
  const normalized = type.toLowerCase();

  if (normalized.includes("sold") || normalized.includes("fulfillment") || normalized.includes("allocation")) return "blue";
  if (normalized.includes("received") || normalized.includes("receipt") || normalized.includes("release") || normalized.includes("return")) return "green";
  if (normalized.includes("damage") || normalized.includes("quarantine") || normalized.includes("recall") || normalized.includes("destruction") || normalized.includes("expired")) return "amber";
  return "slate";
}

function movementLabel(type: string) {
  return type.replaceAll("_", " ").toLowerCase();
}

function directionFor(delta: number) {
  if (delta > 0) return { label: "Inbound", tone: "green" as const };
  if (delta < 0) return { label: "Outbound", tone: "red" as const };
  return { label: "Adjustment", tone: "slate" as const };
}

function formatMovementTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  }).format(date);
}

function formatChange(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

function beforeAfter(movement: InventoryMovement) {
  if (movement.quantityBefore === null || movement.quantityBefore === undefined || movement.quantityAfter === null || movement.quantityAfter === undefined) {
    return "N/A";
  }

  return `${movement.quantityBefore} -> ${movement.quantityAfter}`;
}

export function InventoryMovementAudit({ initialOrderMovements, initialStockMovements }: InventoryMovementAuditProps) {
  const [orderMovements, setOrderMovements] = useState(initialOrderMovements);
  const [stockMovements, setStockMovements] = useState(initialStockMovements);

  useLiveRefresh({
    onRefresh: async () => {
      const response = await fetch("/api/inventory?view=movements", { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.json().catch(() => null);
      if (Array.isArray(payload?.orderMovements)) setOrderMovements(payload.orderMovements);
      if (Array.isArray(payload?.stockMovements)) setStockMovements(payload.stockMovements);
    }
  });

  return (
    <>
      <div className="border-t border-slate-200 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Movement history</h2>
        <p className="mt-1 text-sm text-slate-500">Order-driven inventory activity and direct stock changes.</p>
      </div>

      <Card id="inventory-audit">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Boxes size={17} className="text-blue-700" />
            <CardTitle>Inventory movement audit</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {orderMovements.map((movement) => (
              <div key={movement.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{movement.product}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{movement.batch}</div>
                  </div>
                  <Badge tone={movementTone(movement.type)}>{movementLabel(movement.type)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">Change</div>
                    <div className={movement.delta < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{formatChange(movement.delta)}</div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">User</div>
                    <div className="font-semibold text-slate-950">{movement.staff}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-600">{movement.reason}</div>
                <div className="mt-2 text-xs font-medium text-slate-500">{formatMovementTime(movement.at)}</div>
              </div>
            ))}
            {orderMovements.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No order inventory movements yet.</div> : null}
          </div>

          <DataTable className="hidden md:block" columns={["Time", "Product", "Stock ID", "Type", "Change", "Reason", "User"]}>
            {orderMovements.map((movement) => (
              <tr key={movement.id}>
                <Td>{formatMovementTime(movement.at)}</Td>
                <Td className="font-medium text-slate-950">{movement.product}</Td>
                <Td className="font-mono text-xs">{movement.batch}</Td>
                <Td><Badge tone={movementTone(movement.type)}>{movementLabel(movement.type)}</Badge></Td>
                <Td className={movement.delta < 0 ? "text-red-600" : "text-emerald-700"}>{formatChange(movement.delta)}</Td>
                <Td>{movement.reason}</Td>
                <Td>{movement.staff}</Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Card id="stock-movement-audit">
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <ArrowDownToLine size={17} className="text-emerald-700" />
              <ArrowUpFromLine size={17} className="text-red-600" />
              <CardTitle>Inbound/outbound</CardTitle>
            </div>
            <p className="mt-1 text-sm text-slate-500">Receipts, disposals, count corrections, and other non-order stock changes.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 lg:hidden">
            {stockMovements.map((movement) => {
              const direction = directionFor(movement.delta);
              return (
                <div key={movement.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950">{movement.product}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{movement.batch}</div>
                    </div>
                    <Badge tone={direction.tone}>{direction.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Change</div>
                      <div className={movement.delta < 0 ? "font-semibold text-red-600" : movement.delta > 0 ? "font-semibold text-emerald-700" : "font-semibold text-slate-700"}>{formatChange(movement.delta)}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">Before / after</div>
                      <div className="font-semibold text-slate-950">{beforeAfter(movement)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">{movement.reason}</div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                    <span>{formatMovementTime(movement.at)}</span>
                    <span>{movement.staff}</span>
                  </div>
                </div>
              );
            })}
            {stockMovements.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No direct stock movements yet.</div> : null}
          </div>

          <DataTable className="hidden lg:block" columns={["Time", "Product", "Stock ID", "Direction", "Change", "Before / after", "Reason", "User"]}>
            {stockMovements.map((movement) => {
              const direction = directionFor(movement.delta);
              return (
                <tr key={movement.id}>
                  <Td>{formatMovementTime(movement.at)}</Td>
                  <Td className="font-medium text-slate-950">{movement.product}</Td>
                  <Td className="font-mono text-xs">{movement.batch}</Td>
                  <Td><Badge tone={direction.tone}>{direction.label}</Badge></Td>
                  <Td className={movement.delta < 0 ? "text-red-600" : movement.delta > 0 ? "text-emerald-700" : "text-slate-700"}>{formatChange(movement.delta)}</Td>
                  <Td className="font-medium text-slate-950">{beforeAfter(movement)}</Td>
                  <Td>{movement.reason}</Td>
                  <Td>{movement.staff}</Td>
                </tr>
              );
            })}
          </DataTable>
        </CardContent>
      </Card>
    </>
  );
}
