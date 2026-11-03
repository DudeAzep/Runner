import Link from "next/link";
import { ProjectLogo } from "@/components/campaign/ProjectLogo";
import { CampaignStatusBadge, RiskBadge } from "@/components/campaign/StatusBadges";
import { Badge, SourceBadge } from "@/components/ui/Badge";
import { adminRepository } from "@/lib/auth/admin-data";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { formatDate, formatUsdCents } from "@/lib/format";

export const metadata = { title: "Campaigns" };

export default async function AdminCampaignsPage() {
  const { repo } = await adminRepository();
  const campaigns = await repo.listAllCampaigns();

  return (
    <div>
      <p className="label text-violet-400">Admin</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Campaign management</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Campaigns are created from approved applications. Open a campaign to edit details, change status, and record simulated treasury
        purchases and distributions.
      </p>

      <div className="surface mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-ink-700 text-left text-xs text-fg-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="py-3 font-medium">Package</th>
              <th className="py-3 text-right font-medium">Fee</th>
              <th className="py-3 text-right font-medium">Rewards</th>
              <th className="py-3 pl-6 font-medium">Risk</th>
              <th className="py-3 font-medium">Snapshot</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-ink-700">
            {campaigns.map((c) => (
              <tr key={c.id} className="transition hover:bg-ink-800/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/campaigns/${c.id}`} className="flex items-center gap-3">
                    <ProjectLogo ticker={c.ticker} name={c.projectName} size={30} />
                    <span>
                      <span className="block font-medium hover:text-violet-300">{c.projectName}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-fg-subtle">${c.ticker}</span>
                        {c.featured && <Badge tone="violet" className="h-5 px-1.5 text-[10px]">Featured</Badge>}
                        {c.source === "demo" && <SourceBadge source="demo" className="h-5 px-1.5 text-[10px]" />}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="text-fg-muted">{CAMPAIGN_PACKAGES[c.campaignPackage].name}</td>
                <td className="text-right">{formatUsdCents(c.totalCampaignFeeCents)}</td>
                <td className="text-right text-volt-400">{formatUsdCents(c.rewardAllocationCents)}</td>
                <td className="pl-6">
                  <RiskBadge level={c.riskLevel} />
                </td>
                <td className="text-fg-muted">{c.snapshotAt ? formatDate(c.snapshotAt) : "—"}</td>
                <td className="px-4">
                  <CampaignStatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && <p className="px-4 py-10 text-center text-sm text-fg-muted">No campaigns yet.</p>}
      </div>
    </div>
  );
}
