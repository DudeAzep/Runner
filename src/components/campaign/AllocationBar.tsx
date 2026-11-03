import type { CampaignAllocation } from "@/lib/economics/allocation";
import { formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Percent of the total, to at most one decimal (e.g. 7.5). */
function pctOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

/** Shows how a campaign fee was split. Percentages come from the amounts, since each package has its own split. */
export function AllocationBar({ allocation: a, showLegend = true, className }: { allocation: CampaignAllocation; showLegend?: boolean; className?: string }) {
  const rewardPct = pctOf(a.rewardUsdCents, a.totalUsdCents);
  const opsPct = pctOf(a.operationsUsdCents, a.totalUsdCents);
  const reservePct = pctOf(a.reserveUsdCents, a.totalUsdCents);
  const parts = [
    { label: "Token purchases", pct: rewardPct, cents: a.rewardUsdCents, color: "bg-volt-400", text: "text-volt-400" },
    { label: "Operations", pct: opsPct, cents: a.operationsUsdCents, color: "bg-violet-500", text: "text-violet-400" },
    { label: "Reserve", pct: reservePct, cents: a.reserveUsdCents, color: "bg-ink-500", text: "text-fg-muted" },
  ];
  return (
    <div className={className}>
      <div
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-sm"
        role="img"
        aria-label={`${rewardPct}% token purchases, ${opsPct}% operations, ${reservePct}% reserve`}
      >
        {parts.map((p) => (
          <div key={p.label} className={cn(p.color, "h-full")} style={{ width: `${p.pct}%` }} />
        ))}
      </div>
      {showLegend && (
        <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
          {parts.map((p) => (
            <div key={p.label}>
              <dt className="flex items-center gap-1.5 text-fg-subtle">
                <span className={cn("size-2 rounded-[2px]", p.color)} aria-hidden /> {p.label}
              </dt>
              <dd className="tabular mt-1 font-medium text-fg">
                {formatUsdCents(p.cents)} <span className={cn("ml-0.5", p.text)}>{p.pct}%</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** A stored campaign's allocation, in the shape AllocationBar expects. */
export function campaignAllocation(c: {
  totalCampaignFeeCents: number;
  rewardAllocationCents: number;
  operationsAllocationCents: number;
  reserveAllocationCents: number;
}): CampaignAllocation {
  return {
    totalUsdCents: c.totalCampaignFeeCents,
    rewardUsdCents: c.rewardAllocationCents,
    operationsUsdCents: c.operationsAllocationCents,
    reserveUsdCents: c.reserveAllocationCents,
  };
}
