import { Database, GitBranch, KeyRound, Link2, LockKeyhole, ServerCog, ShieldCheck, UsersRound } from "lucide-react";
import { DataTable, Td } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SquareSyncButton } from "@/components/square-sync-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth-constants";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseUnavailable } from "@/lib/offline-store";
import { prisma } from "@/lib/prisma";
import { getSquareConfig } from "@/lib/square";

export const dynamic = "force-dynamic";

type Tone = "blue" | "green" | "amber" | "red" | "slate";

type StatusItem = {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
};

const roles = [
  { role: "Owner", access: "Full access", scope: "Products, inventory, customers, orders, affiliates, analytics, settings, audit" },
  { role: "Operations Admin", access: "Operations control", scope: "Day-to-day selling, stock, reporting, integrations" },
  { role: "Sales", access: "Sales workflow", scope: "Customers, orders, payments, reports" },
  { role: "Warehouse", access: "Stock workflow", scope: "Inventory and order fulfillment" },
  { role: "Finance", access: "Finance workflow", scope: "Orders, payments, refunds, exports, reports" },
  { role: "Viewer", access: "Read only", scope: "Dashboard, customers, orders, inventory, payments, reports" }
];

function configured(value: unknown) {
  return Boolean(typeof value === "string" ? value.trim() : value);
}

function daysFromSeconds(seconds: number) {
  return `${Math.round(seconds / 60 / 60 / 24)} days`;
}

function headerTone(tone: Tone) {
  return tone === "red" ? "rose" : tone;
}

async function databaseStatus(): Promise<StatusItem> {
  if (!process.env.DATABASE_URL) {
    return {
      label: "Database",
      value: "Demo fallback",
      detail: "DATABASE_URL is not configured, so the app uses seed data and in-memory mutations.",
      tone: "amber"
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      label: "Database",
      value: "Connected",
      detail: "Prisma can reach the configured database.",
      tone: "green"
    };
  } catch (error) {
    return {
      label: "Database",
      value: isDatabaseUnavailable(error) ? "Fallback active" : "Needs review",
      detail: error instanceof Error ? error.message.slice(0, 140) : "Database health check failed.",
      tone: "red"
    };
  }
}

function StatusRows({ items }: { items: StatusItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">{item.label}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</div>
            </div>
            <Badge tone={item.tone}>{item.value}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function SettingsPage() {
  const square = getSquareConfig();
  const currentUser = await getCurrentUser();
  const db = await databaseStatus();
  const hostedDemo = process.env.NODE_ENV === "production" && !process.env.DATABASE_URL;
  const deploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "Localhost";
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "Local";
  const commitRef = process.env.VERCEL_GIT_COMMIT_REF ?? "local";

  const runtimeItems: StatusItem[] = [
    db,
    {
      label: "Authentication",
      value: hostedDemo ? "Hosted demo" : "Staff login",
      detail: hostedDemo ? "Production is using the temporary owner login because DATABASE_URL is missing." : "Staff sessions use the app session cookie and role permissions.",
      tone: hostedDemo ? "amber" : "green"
    },
    {
      label: "Session lifetime",
      value: daysFromSeconds(SESSION_MAX_AGE_SECONDS),
      detail: "Session tokens are hashed at rest and verified server-side.",
      tone: "blue"
    },
    {
      label: "Runtime",
      value: process.env.NODE_ENV,
      detail: deploymentUrl,
      tone: process.env.NODE_ENV === "production" ? "green" : "slate"
    }
  ];

  const squareItems: StatusItem[] = [
    {
      label: "Environment",
      value: square.environment,
      detail: "Square API mode selected by SQUARE_ENVIRONMENT.",
      tone: square.environment === "production" ? "green" : "blue"
    },
    {
      label: "Access token",
      value: configured(square.accessToken) ? "Configured" : "Missing",
      detail: "Required before importing orders and payments.",
      tone: configured(square.accessToken) ? "green" : "amber"
    },
    {
      label: "Location ID",
      value: configured(square.locationId) ? "Configured" : "Missing",
      detail: "Required to scope Square sales to the correct location.",
      tone: configured(square.locationId) ? "green" : "amber"
    },
    {
      label: "Webhook signature",
      value: configured(square.webhookSignatureKey) ? "Configured" : "Missing",
      detail: "Used to verify Square webhook payloads.",
      tone: configured(square.webhookSignatureKey) ? "green" : "amber"
    }
  ];

  const deploymentItems: StatusItem[] = [
    {
      label: "Git branch",
      value: commitRef,
      detail: `Latest deployed commit: ${commitSha}`,
      tone: commitRef === "main" ? "green" : "blue"
    },
    {
      label: "Rollback marker",
      value: "Available",
      detail: "Git tag rollback-before-ui-overhaul-2026-07-06 remains available for pre-overhaul rollback.",
      tone: "green"
    },
    {
      label: "Secrets display",
      value: "Redacted",
      detail: "Settings only show configured/missing state, never secret values.",
      tone: "green"
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Settings control room"
        description="Operational controls for access, data source, Square connection, deployment status, rollback readiness, and security posture."
        icon={ShieldCheck}
        kicker={hostedDemo ? "Demo fallback active" : "Staff workspace"}
        stats={[
          { label: "Database", value: db.value, detail: db.detail, icon: Database, tone: headerTone(db.tone) },
          { label: "Authentication", value: hostedDemo ? "Hosted demo" : "Staff login", detail: hostedDemo ? "Temporary owner login enabled" : "Role permissions enforced server-side", icon: KeyRound, tone: hostedDemo ? "amber" : "green" },
          { label: "Square token", value: configured(square.accessToken) ? "Configured" : "Missing", detail: `${square.environment} environment`, icon: Link2, tone: configured(square.accessToken) ? "green" : "amber" },
          { label: "Deployment", value: commitRef, detail: `Commit ${commitSha} / rollback tag available`, icon: GitBranch, tone: commitRef === "main" ? "green" : "blue" }
        ]}
        actions={<SquareSyncButton />}
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerCog size={17} className="text-blue-700" />
              <CardTitle>Runtime health</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <StatusRows items={runtimeItems} />
          </CardContent>
        </Card>

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
                {(currentUser?.roles ?? ["VIEWER"]).map((role) => <Badge key={role} tone={role === "OWNER" ? "green" : "blue"}>{role}</Badge>)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
              Owner access includes every mutation currently exposed by the app. Lower-privilege roles stay constrained by server-side permission checks.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 size={17} className="text-blue-700" />
              <CardTitle>Square integration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusRows items={squareItems} />
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-sm font-semibold text-slate-950">Manual sync</div>
              <SquareSyncButton compact />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch size={17} className="text-blue-700" />
              <CardTitle>Deployment</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <StatusRows items={deploymentItems} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-blue-700" />
              <CardTitle>Security posture</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <LockKeyhole className="mb-3 h-5 w-5 text-slate-700" />
              <div className="font-semibold text-slate-950">Secret handling</div>
              <div className="mt-1 text-slate-500">Tokens and keys stay in environment variables and audit output is redacted.</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <Database className="mb-3 h-5 w-5 text-slate-700" />
              <div className="font-semibold text-slate-950">Data fallback</div>
              <div className="mt-1 text-slate-500">Demo mode keeps product, customer, order, affiliate, and stock workflows usable.</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <KeyRound className="mb-3 h-5 w-5 text-slate-700" />
              <div className="font-semibold text-slate-950">Server checks</div>
              <div className="mt-1 text-slate-500">All sensitive mutation routes require permissions before writing data.</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <ServerCog className="mb-3 h-5 w-5 text-slate-700" />
              <div className="font-semibold text-slate-950">Validation</div>
              <div className="mt-1 text-slate-500">Zod schemas validate products, customers, orders, inventory, and affiliate inputs.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersRound size={17} className="text-blue-700" />
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
