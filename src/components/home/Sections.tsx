import { ArrowRight, BadgeCheck, Coins, Eye, FileText, History, Landmark, ScanSearch, Send, Users } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "@/components/layout/PageHeader";
import { allocationForPackage, CAMPAIGN_PACKAGES, PACKAGE_IDS } from "@/lib/economics/allocation";
import { formatUsdCents } from "@/lib/format";

const STEPS = [
  {
    icon: Send,
    title: "Projects apply",
    body: "Solana memecoin teams submit their token, links, and a campaign package. Fees are paid in USDC.",
  },
  {
    icon: ScanSearch,
    title: "RUNNER screens",
    body: "Every applicant is independently reviewed across liquidity, holder concentration, authorities, and manipulation signals.",
  },
  {
    icon: Landmark,
    title: "Treasury purchases",
    body: "For approved campaigns, 70–90% of the fee (more on bigger packages) is used by the treasury to buy the project's token on the open market.",
  },
  {
    icon: Users,
    title: "Holders receive distributions",
    body: "Purchased tokens are split among eligible RUNNER holders based on how much each one holds, using a published balance snapshot.",
  },
];

export function HowItWorksSteps() {
  return (
    <div>
      <SectionHeading
        eyebrow="How RUNNER works"
        title="From application to distribution"
        description="A transparent four-step pipeline. Fees never buy approval — screening decides."
      />
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="surface surface-hover relative p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex size-9 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/10">
                <s.icon className="size-4 text-violet-300" aria-hidden />
              </span>
              <span className="font-mono text-xs text-fg-subtle">0{i + 1}</span>
            </div>
            <h3 className="mt-5 text-[15px] font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="absolute -right-[13px] top-1/2 hidden h-px w-[22px] bg-gradient-to-r from-ink-500 to-transparent lg:block" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AllocationExplainer() {
  // The breakdown shows the Featured package; the table below compares all three.
  const featured = CAMPAIGN_PACKAGES.featured;
  const bps = featured.allocationBps;
  const example = allocationForPackage("featured");
  const parts = [
    { pct: bps.reward / 100, label: "Token purchases", body: "Treasury buys the approved project's token for holder distributions.", color: "bg-volt-400", cents: example.rewardUsdCents },
    { pct: bps.operations / 100, label: "Operations", body: "Screening, infrastructure, security, and platform development.", color: "bg-violet-500", cents: example.operationsUsdCents },
    { pct: bps.reserve / 100, label: "Treasury reserve", body: "Held for contingencies and future ecosystem needs.", color: "bg-ink-500", cents: example.reserveUsdCents },
  ];
  const rewardShares = PACKAGE_IDS.map((id) => `${CAMPAIGN_PACKAGES[id].name} ${CAMPAIGN_PACKAGES[id].allocationBps.reward / 100}%`).join(", ");
  return (
    <div id="allocation" className="grid scroll-mt-24 gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center [&>*]:min-w-0">
      <SectionHeading
        eyebrow="Revenue allocation"
        title="Where every campaign dollar goes"
        description={`Each package's split is fixed by protocol rules and enforced in code. Bigger packages put more of the fee into token purchases for holders: ${rewardShares}.`}
      />
      <div className="surface p-6">
        <div className="mb-3 flex items-center justify-between text-xs text-fg-subtle">
          <span>
            {featured.name} package · {formatUsdCents(featured.feeUsdCents)}
          </span>
          <span className="rounded-full bg-volt-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-950">Best value</span>
        </div>
        <div
          className="flex h-3 gap-1 overflow-hidden rounded-sm"
          role="img"
          aria-label={`${bps.reward / 100} / ${bps.operations / 100} / ${bps.reserve / 100} allocation`}
        >
          {parts.map((p) => (
            <div key={p.label} className={p.color} style={{ width: `${p.pct}%` }} />
          ))}
        </div>
        <ul className="mt-6 divide-y divide-ink-700">
          {parts.map((p) => (
            <li key={p.label} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              <span className="tabular w-14 shrink-0 text-2xl font-semibold tracking-tight">{p.pct}%</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className={`size-2 rounded-[2px] ${p.color}`} aria-hidden /> {p.label}
                </div>
                <p className="mt-1 text-sm text-fg-muted">{p.body}</p>
              </div>
              <span className="tabular shrink-0 text-sm text-fg-muted">{formatUsdCents(p.cents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 overflow-x-auto rounded-md border border-ink-700">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-ink-900 text-xs text-fg-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">Package</th>
                <th className="px-3 py-2 font-medium">Fee</th>
                <th className="px-3 py-2 font-medium">Rec. market cap</th>
                <th className="px-3 py-2 font-medium text-volt-400">Rewards</th>
                <th className="px-3 py-2 font-medium">Ops</th>
                <th className="px-3 py-2 font-medium">Reserve</th>
                <th className="px-3 py-2" aria-hidden />
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-ink-700">
              {PACKAGE_IDS.map((id) => {
                const pk = CAMPAIGN_PACKAGES[id];
                const a = allocationForPackage(id);
                const b = pk.allocationBps;
                return (
                  // The package name link stretches over the whole row, so any part of the row is clickable.
                  <tr key={id} className="group relative transition hover:bg-violet-500/[0.06]">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/submit?package=${id}#package`} className="after:absolute after:inset-0 after:content-['']">
                        {pk.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{formatUsdCents(a.totalUsdCents)}</td>
                    <td className="px-3 py-2">{pk.recommendedMarketCap}</td>
                    <td className="px-3 py-2 text-volt-400">
                      {formatUsdCents(a.rewardUsdCents)} <span className="text-xs font-semibold">· {b.reward / 100}%</span>
                    </td>
                    <td className="px-3 py-2 text-fg-muted">
                      {formatUsdCents(a.operationsUsdCents)} <span className="text-xs text-fg-subtle">· {b.operations / 100}%</span>
                    </td>
                    <td className="px-3 py-2 text-fg-muted">
                      {formatUsdCents(a.reserveUsdCents)} <span className="text-xs text-fg-subtle">· {b.reserve / 100}%</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ArrowRight className="inline size-3.5 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-violet-300" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TRUST = [
  { icon: FileText, title: "Public screening information", body: "Every approved campaign publishes its screening scores, risk flags, and reviewer notes." },
  { icon: BadgeCheck, title: "Campaign disclosures", body: "Fees, package, allocation, and snapshot timing are shown on each campaign page before distribution." },
  { icon: Eye, title: "Treasury transparency", body: "Treasury purchases are recorded per campaign. Verified purchases will link to on-chain signatures." },
  { icon: History, title: "Distribution history", body: "Per-wallet distribution records show balance, share of eligible supply, and amount received." },
];

export function TrustSection() {
  return (
    <div>
      <SectionHeading
        eyebrow="Trust & transparency"
        title="Designed to be verifiable"
        description="RUNNER labels every figure with its source. Demo data is always marked, and nothing is presented as on-chain unless it can be verified."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map((t) => (
          <div key={t.title} className="surface p-5">
            <t.icon className="size-5 text-volt-400" aria-hidden />
            <h3 className="mt-4 text-[15px] font-semibold">{t.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RewardFormula() {
  return (
    <div id="rewards" className="surface scroll-mt-24 p-6">
      <div className="flex items-center gap-2">
        <Coins className="size-4 text-volt-400" aria-hidden />
        <h3 className="text-[15px] font-semibold">Proportional reward formula</h3>
      </div>
      <div className="mt-5 space-y-3 rounded-md border border-ink-700 bg-ink-900 p-4 font-mono text-[13px] leading-relaxed">
        <p>
          <span className="text-violet-300">share</span> = holder_eligible_balance ÷ total_eligible_balance
        </p>
        <p>
          <span className="text-volt-400">reward</span> = share × campaign_reward_pool
        </p>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        Example: with 100,000,000 eligible RUNNER and a wallet holding 250,000, the holder owns 0.25% of eligible supply and receives
        0.25% of a $700 reward pool — tokens worth about $1.75 at purchase price.
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-fg-muted">
        <li>• Balances are read from a single published snapshot.</li>
        <li>• Treasury, liquidity pool, and team wallets are excluded from eligible supply.</li>
        <li>• Amounts are floored to the token&apos;s smallest unit; totals can never exceed the pool.</li>
        <li>• Rewards below the minimum payout are carried forward rather than lost.</li>
      </ul>
    </div>
  );
}
