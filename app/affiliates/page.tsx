import { Handshake } from "lucide-react";
import { AffiliateApplicationTrigger, AffiliatesWorkbench } from "@/components/affiliates-workbench";
import { PageHeader } from "@/components/page-header";
import { getAffiliates } from "@/lib/services/operational-data";
import { loadAffiliateProgram } from "@/lib/services/affiliate-data";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage() {
  const [affiliates, program] = await Promise.all([
    getAffiliates({ includeArchived: true }),
    loadAffiliateProgram()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Affiliate operations"
        title="Affiliates"
        description="Review affiliate codes, manage partner access, and keep referral performance and payouts organized."
        icon={Handshake}
        actions={<AffiliateApplicationTrigger />}
      />

      <AffiliatesWorkbench affiliates={affiliates} program={program} />
    </div>
  );
}
