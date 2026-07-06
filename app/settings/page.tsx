import { KeyRound, Link2, UsersRound } from "lucide-react";
import { DataTable, Td } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSquareConfig } from "@/lib/square";

const roles = [
  { role: "Owner", access: "Full access to dashboards, products, inventory, customers, orders, affiliates, analytics, settings, and audit logs" }
];

export default function SettingsPage() {
  const square = getSquareConfig();

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Administration</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Review owner access, Square integration status, audit coverage, and production security controls.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersRound size={17} className="text-blue-700" />
              <CardTitle>Owner access</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={["Role", "Access"]}>
              {roles.map((role) => (
                <tr key={role.role}>
                  <Td className="font-medium text-slate-950">{role.role}</Td>
                  <Td>{role.access}</Td>
                </tr>
              ))}
            </DataTable>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 size={17} className="text-blue-700" />
              <CardTitle>Square integration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border bg-slate-50 p-3">
              <span>Environment</span>
              <Badge tone="blue">{square.environment}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-slate-50 p-3">
              <span>Access token</span>
              <Badge tone={square.accessToken ? "green" : "amber"}>{square.accessToken ? "Configured" : "Missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-slate-50 p-3">
              <span>Location ID</span>
              <Badge tone={square.locationId ? "green" : "amber"}>{square.locationId ? "Configured" : "Missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-slate-50 p-3">
              <span>Webhook signature key</span>
              <Badge tone={square.webhookSignatureKey ? "green" : "amber"}>{square.webhookSignatureKey ? "Configured" : "Missing"}</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound size={17} className="text-blue-700" />
              <CardTitle>Security posture</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Server-side validation with Zod is included for sensitive mutations.</p>
            <p>Secrets are referenced only through environment variables.</p>
            <p>Production should add route-level rate limiting and managed secrets.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
