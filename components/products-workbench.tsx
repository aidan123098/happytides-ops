"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Product } from "@/types/domain";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/utils";

export function ProductsWorkbench({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const categories = [...new Set(products.map((product) => product.category))];
  const filteredProducts = products.filter((product) => {
    const matchesSearch = [product.name, product.sku, product.category, product.peptideType, product.strengthLabel].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || product.category === category;
    const matchesStatus = status === "all" || (status === "active" ? product.active : !product.active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Active peptide catalog</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Search and filter live catalog records by SKU, category, and active status.</p>
        </div>
        <Badge tone="blue">{filteredProducts.length} SKUs</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 md:grid-cols-[minmax(180px,1fr)_220px_160px]">
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Search</span>
            <Input className="mt-1 bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU, product, category" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Category</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-ring/30" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <DataTable columns={["Product", "SKU", "Category", "Strength", "Price", "COGS", "Margin", "COA", "Status"]}>
          {filteredProducts.map((product) => (
            <tr key={product.id}>
              <Td>
                <div className="flex items-center gap-3">
                  <span className="h-8 w-2 rounded-full" style={{ backgroundColor: product.colorAccent }} />
                  <div>
                    <div className="font-medium text-slate-950">{product.name}</div>
                    <div className="text-xs text-slate-500">{product.peptideType}</div>
                  </div>
                </div>
              </Td>
              <Td className="font-mono text-xs">{product.sku}</Td>
              <Td>{product.category}</Td>
              <Td>{product.strengthLabel}</Td>
              <Td className="font-medium text-slate-950">{formatCurrency(product.priceCents)}</Td>
              <Td>{formatCurrency(product.costOfGoodsCents)}</Td>
              <Td>{formatPercent(product.marginPercent)}</Td>
              <Td>
                {product.coaUrl === "N/A" ? "N/A" : (
                  <a className="inline-flex items-center gap-1 text-blue-700 hover:underline" href={product.coaUrl}>
                    COA <ExternalLink size={13} />
                  </a>
                )}
              </Td>
              <Td><Badge tone={product.active ? "green" : "slate"}>{product.active ? "Active" : "Inactive"}</Badge></Td>
            </tr>
          ))}
        </DataTable>
      </CardContent>
    </Card>
  );
}
