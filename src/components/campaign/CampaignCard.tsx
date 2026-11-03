import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AddressChip } from "@/components/ui/AddressChip";
import { SourceBadge } from "@/components/ui/Badge";
import { CAMPAIGN_PACKAGES } from "@/lib/economics/allocation";
import { formatDate, formatInt, formatUsdCents, formatUsdCompact } from "@/lib/format";
import type { Campaign } from "@/lib/types";
import { ProjectLogo } from "./ProjectLogo";
import { SocialLinks } from "./SocialLinks";
import { CampaignStatusBadge, RiskBadge, ScreeningStatusBadge } from "./StatusBadges";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="label truncate">{label}</dt>
      <dd className="tabular mt-1 truncate text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}

/**
 * `liveMarketCapUsd`: pass a value (or null for "not trading") to show a live
 * market cap row; leave it undefined to keep the card as before.
 */
export function CampaignCard({
  campaign: c,
  compact = false,
  liveMarketCapUsd,
  logoUrl,
}: {
  campaign: Campaign;
  compact?: boolean;
  liveMarketCapUsd?: number | null;
  logoUrl?: string | null;
}) {
  const showLive = liveMarketCapUsd !== undefined;
  return (
    <article className="surface surface-hover group relative flex flex-col p-5">
      <div className="flex items-start gap-3.5">
        <ProjectLogo ticker={c.ticker} name={c.projectName} src={logoUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Link href={`/campaigns/${c.slug}`} className="truncate after:absolute after:inset-0 after:content-['']">
              {c.projectName}
            </Link>
            <ArrowUpRight className="size-3.5 shrink-0 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" aria-hidden />
          </h3>
          <p className="mt-0.5 font-mono text-xs text-fg-subtle">${c.ticker}</p>
        </div>
        <CampaignStatusBadge status={c.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <ScreeningStatusBadge />
        <RiskBadge level={c.riskLevel} />
        <SourceBadge source={c.source} />
      </div>

      {showLive && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-volt-400/25 bg-volt-400/[0.06] px-3.5 py-3 shadow-[0_0_24px_-8px] shadow-volt-400/40">
          <span className="label flex items-center gap-2 text-volt-400">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-volt-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-volt-400" />
            </span>
            {c.source === "demo" ? "Market cap (simulated)" : "Live market cap"}
          </span>
          <span className="tabular text-2xl font-bold tracking-tight text-volt-400 [text-shadow:0_0_18px_rgb(76_247_166/0.45)]">
            {liveMarketCapUsd != null ? formatUsdCompact(liveMarketCapUsd) : "Not trading"}
          </span>
        </div>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-ink-700 pt-4">
        <Metric label="Mcap @ screen" value={c.marketCapAtScreeningUsd != null ? formatUsdCompact(c.marketCapAtScreeningUsd) : "—"} />
        <Metric label="Liquidity" value={c.liquidityAtScreeningUsd != null ? formatUsdCompact(c.liquidityAtScreeningUsd) : "—"} />
        <Metric label="Holders" value={c.holderCountAtScreening != null ? formatInt(c.holderCountAtScreening) : "N/A"} />
      </dl>

      <div className="mt-4 flex items-end justify-between gap-3 rounded-md border border-ink-700 bg-ink-900/60 px-3.5 py-3">
        <div>
          <div className="label">Reward allocation</div>
          <div className="tabular mt-1 text-lg font-semibold text-volt-400">{formatUsdCents(c.rewardAllocationCents)}</div>
        </div>
        <div className="text-right text-xs text-fg-subtle">
          <div>{CAMPAIGN_PACKAGES[c.campaignPackage].name} package</div>
          <div className="mt-0.5">Screened {formatDate(c.screeningDate)}</div>
        </div>
      </div>

      {!compact && (
        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3">
          <AddressChip address={c.tokenAddress} kind="token" />
          <SocialLinks links={c} size="sm" />
        </div>
      )}
    </article>
  );
}
