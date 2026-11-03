import { ArrowRight, Coins, Landmark, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { ProjectLogo } from "@/components/campaign/ProjectLogo";
import { CampaignStatusBadge } from "@/components/campaign/StatusBadges";
import { SourceBadge } from "@/components/ui/Badge";
import { calculateCampaignAllocation } from "@/lib/economics/allocation";
import { estimateUsdReward } from "@/lib/economics/rewards";
import { formatPercent, formatUsdCents } from "@/lib/format";
import { SCREENING_CRITERIA, type Campaign, type Screening } from "@/lib/types";

/** A screening check counts as passed at 6/10 or higher (below that the report shows it amber/red). */
const PASS_SCORE = 6;

/** Hero visual: how one campaign fee flows to holders, using a real (demo) campaign record. */
export function HeroFlow({ campaign, screening }: { campaign: Campaign; screening: Screening | null }) {
  const a = calculateCampaignAllocation(campaign.totalCampaignFeeCents);
  const example = estimateUsdReward(250_000n, 100_000_000n, a.rewardUsdCents);
  const total = SCREENING_CRITERIA.length;
  const passed = screening ? SCREENING_CRITERIA.filter((c) => screening[c.key] >= PASS_SCORE).length : null;
  const screeningValue = passed != null ? `${passed}/${total} checks · ${Math.round((passed / total) * 100)}%` : `${total} checks`;
  const rows = [
    { icon: ShieldCheck, label: "Screening passed", value: screeningValue, tone: "text-volt-400" },
    { icon: Coins, label: "Campaign fee", value: formatUsdCents(a.totalUsdCents) + " USDC", tone: "text-fg" },
    { icon: Landmark, label: "Treasury buys $" + campaign.ticker, value: formatUsdCents(a.rewardUsdCents), tone: "text-volt-400" },
    { icon: Users, label: "Split among holders", value: "by how much you hold", tone: "text-fg-muted" },
  ];
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-8 rounded-[28px] bg-[radial-gradient(closest-side,rgb(139_92_246/0.22),transparent)] blur-2xl" />
      <div className="surface relative overflow-hidden p-5 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)] sm:p-6">
        <div className="flex items-center gap-3">
          <ProjectLogo ticker={campaign.ticker} name={campaign.projectName} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{campaign.projectName}</div>
            <div className="font-mono text-xs text-fg-subtle">${campaign.ticker} · Featured campaign</div>
          </div>
          <CampaignStatusBadge status={campaign.status} />
        </div>

        <ol className="relative mt-6 space-y-3">
          <svg aria-hidden className="absolute left-[15px] top-4 h-[calc(100%-2rem)] w-px overflow-visible" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="0" y2="100%" stroke="#2a2a36" strokeWidth="2" />
            <line x1="0" y1="0" x2="0" y2="100%" stroke="#4cf7a6" strokeWidth="2" strokeDasharray="4 16" className="animate-dash" />
          </svg>
          {rows.map(({ icon: Icon, label, value, tone }) => (
            <li key={label} className="relative flex items-center gap-3">
              <span className="relative z-10 inline-flex size-8 items-center justify-center rounded-md border border-ink-600 bg-ink-850">
                <Icon className="size-4 text-violet-400" aria-hidden />
              </span>
              <span className="flex-1 text-sm text-fg-muted">{label}</span>
              <span className={`tabular text-sm font-medium ${tone}`}>{value}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-md border border-ink-700 bg-ink-900 p-4">
          <div className="flex items-center justify-between">
            <span className="label">Example holder share</span>
            <SourceBadge source="demo" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-fg-subtle">Balance</div>
              <div className="tabular mt-1 font-medium">250,000</div>
            </div>
            <div>
              <div className="text-xs text-fg-subtle">Share</div>
              <div className="tabular mt-1 font-medium">{formatPercent(example.percentage)}</div>
            </div>
            <div>
              <div className="text-xs text-fg-subtle">Est. reward</div>
              <div className="tabular mt-1 font-medium text-volt-400">{formatUsdCents(example.rewardUsdCents, { forceCents: true })}</div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
            Illustrative: 250,000 of 100,000,000 eligible RUNNER. Reward is paid in ${campaign.ticker}, whose value can change.
          </p>
        </div>

        <Link href={`/campaigns/${campaign.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-violet-300 hover:text-violet-200">
          View campaign disclosure <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
