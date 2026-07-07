import { ShieldCheck, UsersRound } from "lucide-react";
import { DataTable, Td } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const roles = [
  { role: "Owner", access: "Full access", scope: "Products, inventory, customers, orders, affiliates, analytics, settings, audit" },
  { role: "Operations Admin", access: "Operations control", scope: "Day-to-day selling, stock, reporting, integrations" },
  { role: "Sales", access: "Sales workflow", scope: "Customers, orders, payments, reports" },
  { role: "Warehouse", access: "Stock workflow", scope: "Inventory and order fulfillment" },
  { role: "Finance", access: "Finance workflow", scope: "Orders, payments, refunds, exports, reports" },
  { role: "Viewer", access: "Read only", scope: "Dashboard, customers, orders, inventory, payments, reports" }
];

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  const currentRoles = currentUser?.roles ?? ["VIEWER"];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Review the signed-in staff account and role access for the HappyTides workspace."
        icon={ShieldCheck}
        kicker="Staff workspace"
        stats={[
          {
            label: "Current user",
            value: currentUser?.name ?? "Signed out",
            detail: currentUser?.email ?? "No active session",
            icon: UsersRound,
            tone: currentUser ? "green" : "slate"
          },
          {
            label: "Access level",
            value: currentRoles.join(", "),
            detail: "Role permissions stay enforced server-side across app actions.",
            icon: ShieldCheck,
            tone: currentRoles.includes("OWNER") ? "green" : "blue"
          }
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersRound size={17} className="text-blue-700" />
              <CardTitle>Current access</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-950">{currentUser?.name ?? "Signed out"}</div>
              <div className="mt-1 text-xs text-slate-500">{currentUser?.email ?? "No active session"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {currentRoles.map((role) => <Badge key={role} tone={role === "OWNER" ? "green" : "blue"}>{role}</Badge>)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
              Use this page to confirm which staff account is active before managing orders, customers, inventory, or products.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-blue-700" />
              <CardTitle>Role matrix</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={["Role", "Access", "Scope"]}>
              {roles.map((role) => (
                <tr key={role.role}>
                  <Td className="font-medium text-slate-950">{role.role}</Td>
                  <Td>{role.access}</Td>
                  <Td>{role.scope}</Td>
                </tr>
              ))}
            </DataTable>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
