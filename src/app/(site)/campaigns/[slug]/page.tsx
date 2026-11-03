import { ArrowLeft, CalendarClock, Landmark, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AllocationBar } from "@/components/campaign/AllocationBar";
import { ProjectLogo } from "@/components/campaign/ProjectLogo";
import { ScreeningReport } from "@/components/campaign/ScreeningReport";
import { SocialLinks } from "@/components/campaign/SocialLinks";
import { CampaignStatusBadge, RiskBadge, ScreeningStatusBadge } from "@/components/campaign/StatusBadges";
import { Container } from "@/components/layout/PageHeader";
import { AddressChip } from "@/components/ui/AddressChip";
import { Badge, SourceBadge } from "@/components/ui/Badge";
import { getPublicConfig } from "@/lib/config";
import { getRepositoryForRequest } from "@/lib/data";
import { fromBaseUnits } from "@/lib/economics/rewards";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { formatDate, formatDateTime, formatInt, formatUsdCents, formatUsdCompact } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const repo = await getRepositoryForRequest();
  const d = await repo.getCampaignDetail(slug);
  return d ? { title: `${d.campaign.projectName} ($${d.campaign.ticker})` } : { title: "Campaign not found" };
}

function Panel({ title, icon, children, aside }: { title: string; icon?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="tabular min-w-0 text-right text-fg">{children}</dd>
    </div>
  );
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = await getRepositoryForRequest();
  const detail = await repo.getCampaignDetail(slug);
  if (!detail) notFound();
  const { campaign: c, screening, purchases, snapshot, distributionSummary } = detail;
  const cluster = getPublicConfig().cluster;
  const txUrl = (sig: string) => `https://solscan.io/tx/${sig}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
  const pkg = CAMPAIGN_PACKAGES[c.campaignPackage];
  const spentCents = purchases.reduce((s, p) => s + p.usdcSpentCents, 0);

  return (
    <Container className="pt-8">
      <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All campaigns
      </Link>

      {/* Header */}
      <header className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <ProjectLogo ticker={c.ticker} name={c.projectName} size={64} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{c.projectName}</h1>
              <span className="font-mono text-sm text-fg-subtle">${c.ticker}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <CampaignStatusBadge status={c.status} />
              <ScreeningStatusBadge />
              <RiskBadge level={c.riskLevel} />
              <SourceBadge source={c.source} />
              {c.featured && <Badge tone="violet">Featured</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <SocialLinks links={c} />
          <AddressChip address={c.tokenAddress} kind="token" />
        </div>
      </header>

      {c.source === "demo" && (
        <p className="mt-6 rounded-md border border-amber-400/25 bg-amber-400/[0.05] px-4 py-3 text-sm text-fg-muted">
          <span className="font-medium text-amber-400">DEMO DATA.</span> {c.projectName} is a fictional sample project. Its address, market
          figures, and campaign records are illustrative and not real on-chain data.
        </p>
      )}

      {/* Key metrics */}
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-700 bg-ink-700 lg:grid-cols-4">
        {[
          ["Market cap at screening", c.marketCapAtScreeningUsd != null ? formatUsdCompact(c.marketCapAtScreeningUsd) : "—"],
          ["Liquidity at screening", c.liquidityAtScreeningUsd != null ? formatUsdCompact(c.liquidityAtScreeningUsd) : "—"],
          ["Holders at screening", c.holderCountAtScreening != null ? formatInt(c.holderCountAtScreening) : "Not available"],
          ["Reward allocation", formatUsdCents(c.rewardAllocationCents)],
        ].map(([label, value]) => (
          <div key={label} className="bg-ink-850 p-5">
            <dt className="label">{label}</dt>
            <dd className="tabular mt-2 text-xl font-semibold tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          <Panel title="Project information">
            <p className="text-sm leading-relaxed text-fg-muted">{c.description}</p>
          </Panel>

          <Panel title="Screening report" aside={<span className="text-xs text-fg-subtle">Screened {formatDate(c.screeningDate)}</span>}>
            {screening ? <ScreeningReport screening={screening} /> : <p className="text-sm text-fg-muted">Screening report not published.</p>}
          </Panel>

          <Panel title="Token information">
            <dl className="divide-y divide-ink-700">
              <Row label="Token">
                {c.projectName} (${c.ticker})
              </Row>
              <Row label="Network">Solana</Row>
              <Row label="Contract address">
                <AddressChip address={c.tokenAddress} kind="token" full className="text-left" />
              </Row>
              <Row label="Top-10 holder share">{screening?.top10HolderPct != null ? `${screening.top10HolderPct}%` : "—"}</Row>
              <Row label="Data source">
                <SourceBadge source={c.source} />
              </Row>
            </dl>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Campaign economics">
            <dl className="divide-y divide-ink-700">
              <Row label="Package">{pkg.name}</Row>
              <Row label="Campaign fee">{formatUsdCents(c.totalCampaignFeeCents)} USDC</Row>
            </dl>
            <AllocationBar totalCents={c.totalCampaignFeeCents} className="mt-4" />
          </Panel>

          <Panel title="Treasury purchase allocation" icon={<Landmark className="size-4 text-volt-400" />}>
            <dl className="divide-y divide-ink-700">
              <Row label="Allocated for purchase">{formatUsdCents(c.rewardAllocationCents)}</Row>
              <Row label="Purchased to date">{formatUsdCents(spentCents)}</Row>
            </dl>
            {purchases.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {purchases.map((p) => (
                  <li key={p.id} className="rounded-md border border-ink-700 bg-ink-900 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="tabular font-medium">
                        {Number(p.tokenAmount).toLocaleString("en-US", { maximumFractionDigits: 2 })} {c.ticker}
                      </span>
                      <Badge tone={p.status === "confirmed" ? "volt" : "amber"}>{p.status === "simulated" ? "SIMULATED" : p.status.toUpperCase()}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-fg-subtle">
                      {formatUsdCents(p.usdcSpentCents)} USDC · {formatDateTime(p.executedAt)}
                    </div>
                    <div className="mt-1 text-xs text-fg-subtle">
                      {p.transactionSignature ? (
                        <a href={txUrl(p.transactionSignature)} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-violet-300 hover:underline">
                          View transaction ↗
                        </a>
                      ) : (
                        "No on-chain transaction (simulated record)."
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-fg-muted">No treasury purchase recorded yet.</p>
            )}
          </Panel>

          <Panel title="Distribution information" icon={<Users className="size-4 text-violet-400" />}>
            <dl className="divide-y divide-ink-700">
              <Row label="Snapshot">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5 text-fg-subtle" />
                  {c.snapshotAt ? formatDateTime(c.snapshotAt) : "To be announced"}
                </span>
              </Row>
              <Row label="Snapshot status">
                {snapshot ? (
                  <span className="inline-flex items-center gap-2">
                    Taken{snapshot.slot ? ` · slot ${snapshot.slot}` : ""} <SourceBadge source={snapshot.source} />
                  </span>
                ) : (
                  "Not taken yet"
                )}
              </Row>
              <Row label="Eligible RUNNER supply">{c.eligibleSupply ? fromBaseUnits(BigInt(c.eligibleSupply), c.runnerDecimals, 2) : "Set at snapshot"}</Row>
              <Row label="Eligible holders">{snapshot ? formatInt(snapshot.holderCount) : "—"}</Row>
              <Row label="Recipients">{formatInt(distributionSummary.recipientCount)}</Row>
              <Row label="Tokens distributed">
                {distributionSummary.recipientCount ? `${distributionSummary.totalRewardTokens} ${c.ticker}` : "—"}
              </Row>
              <Row label="Status">
                {distributionSummary.status === "not_started" ? (
                  <Badge>Not started</Badge>
                ) : distributionSummary.status === "planned" ? (
                  <Badge tone="violet">Planned</Badge>
                ) : distributionSummary.status === "in_progress" ? (
                  <Badge tone="sky">
                    In progress · {distributionSummary.confirmedCount}/{distributionSummary.recipientCount}
                  </Badge>
                ) : distributionSummary.status === "verified" ? (
                  <Badge tone="volt">Verified on-chain</Badge>
                ) : (
                  <Badge tone="amber">SIMULATED</Badge>
                )}
              </Row>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
              Rewards are proportional: your eligible RUNNER balance ÷ total eligible supply × the reward pool. Treasury, LP, and team
              wallets are excluded from eligible supply.
            </p>
          </Panel>
        </div>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-fg-subtle">
        Campaign participation does not guarantee token appreciation, liquidity, profits, or successful project outcomes. Screening is a risk
        review, not an endorsement. See the full risk disclosure below.
      </p>
    </Container>
  );
}
