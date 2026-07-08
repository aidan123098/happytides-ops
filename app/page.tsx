import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { getDashboardSnapshot } from "@/lib/live-metrics";
import { getAnalyticsStore } from "@/lib/services/operational-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboard = getDashboardSnapshot(await getAnalyticsStore());

  return <DashboardWorkspace initialDashboard={dashboard} />;
}
