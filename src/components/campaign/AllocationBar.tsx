import { calculateCampaignAllocation } from "@/lib/economics/allocation";
import { formatUsdCents } from "@/lib/format";
import { cn } from "@/lib/cn";

export function AllocationBar({ totalCents, showLegend = true, className }: { totalCents: number; showLegend?: boolean; className?: string }) {
  const a = calculateCampaignAllocation(totalCents);
  const parts = [
    { label: "Token purchases", pct: 70, cents: a.rewardUsdCents, color: "bg-volt-400", text: "text-volt-400" },
    { label: "Operations", pct: 20, cents: a.operationsUsdCents, color: "bg-violet-500", text: "text-violet-400" },
    { label: "Reserve", pct: 10, cents: a.reserveUsdCents, color: "bg-ink-500", text: "text-fg-muted" },
  ];
  return (
    <div className={className}>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-sm" role="img" aria-label="70% token purchases, 20% operations, 10% reserve">
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
