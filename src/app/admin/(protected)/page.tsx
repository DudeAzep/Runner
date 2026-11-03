import { Ban, CircleDollarSign, Clock, FileText, Landmark, Layers } from "lucide-react";
import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/campaign/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { StatisticsCard } from "@/components/ui/StatisticsCard";
import { adminRepository } from "@/lib/auth/admin-data";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { getConfig } from "@/lib/config";
import { formatDate, formatInt, formatUsdCents } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const { repo } = await adminRepository();
  const o = repo.getAdminOverview();
  const apps = repo.listApplications({ status: "all" });
  const verifiedRevenue = repo.getVerifiedRevenueCents();
  const cfg = getConfig();
  const queue = apps.filter((a) => a.status === "submitted" || a.status === "under_review").slice(0, 6);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-violet-400">Admin</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Overview</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={cfg.paymentsLive ? "volt" : "amber"}>Payments {cfg.paymentsLive ? "LIVE" : "TEST MODE"}</Badge>
          <Badge tone={cfg.treasuryLive ? "volt" : "amber"}>Treasury {cfg.treasuryLive ? "LIVE" : "SIMULATED"}</Badge>
          {cfg.cluster === "devnet" && <Badge tone="amber">DEVNET</Badge>}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatisticsCard label="Total applications" value={formatInt(o.totalApplications)} icon={FileText} />
        <StatisticsCard label="Pending applications" value={formatInt(o.pendingApplications)} icon={Clock} hint="Submitted + under review" />
        <StatisticsCard label="Approved campaigns" value={formatInt(o.approvedCampaigns)} icon={Layers} accent="volt" />
        <StatisticsCard label="Rejected applications" value={formatInt(o.rejectedApplications)} icon={Ban} accent="neutral" />
        <StatisticsCard
          label="Campaign revenue (booked)"
          value={formatUsdCents(o.simulatedRevenueCents)}
          icon={CircleDollarSign}
          hint={`Approved campaigns · ${formatUsdCents(verifiedRevenue)} verified USDC received on-chain`}
        />
        <StatisticsCard
          label="Token purchase allocation"
          value={formatUsdCents(o.simulatedRewardAllocationCents)}
          icon={Landmark}
          accent="volt"
          hint={`Ops ${formatUsdCents(o.simulatedOperationsCents)} · Reserve ${formatUsdCents(o.simulatedReserveCents)}`}
        />
      </div>

      <section className="surface mt-8 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Screening queue</h2>
          <Link href="/admin/applications?status=submitted" className="text-xs text-violet-300 hover:text-violet-200">
            View all →
          </Link>
        </div>
        {queue.length ? (
          <ul className="mt-4 divide-y divide-ink-700">
            {queue.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/applications/${a.id}`} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-violet-200">
                  <span className="min-w-0">
                    <span className="font-medium">{a.projectName}</span> <span className="font-mono text-xs text-fg-subtle">${a.ticker}</span>
                    <span className="block text-xs text-fg-subtle">
                      {a.reference} · {CAMPAIGN_PACKAGES[a.campaignPackage].name} · {formatDate(a.createdAt)}
                    </span>
                  </span>
                  <ApplicationStatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-fg-muted">The queue is empty.</p>
        )}
      </section>
    </div>
  );
}
