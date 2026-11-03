import { Lock } from "lucide-react";
import { formatUsdCompact } from "@/lib/format";

/**
 * Blurred preview of an applicant still under review. It deliberately receives
 * only the market cap: the name, ticker and address never reach the browser,
 * so the blur can't be undone with dev tools.
 */
export function TeaserCard({ marketCapUsd, demo = false }: { marketCapUsd: number | null; demo?: boolean }) {
  return (
    <article className="surface relative flex flex-col overflow-hidden p-5" aria-label="Unrevealed project under review">
      <div aria-hidden className="pointer-events-none select-none blur-md">
        <div className="flex items-start gap-3.5">
          <div className="size-11 shrink-0 rounded-full bg-gradient-to-br from-volt-400/70 via-ink-600 to-amber-400/60" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-32 rounded bg-fg/40" />
            <div className="h-2.5 w-14 rounded bg-fg/25" />
          </div>
        </div>
        <div className="mt-5 flex gap-1.5">
          <div className="h-5 w-20 rounded bg-volt-400/30" />
          <div className="h-5 w-16 rounded bg-amber-400/30" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-ink-700 pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-2 w-12 rounded bg-fg/20" />
              <div className="h-3 w-16 rounded bg-fg/35" />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-5 top-5 flex justify-end gap-1.5">
        {demo && (
          <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-ink-850/90 px-2 py-0.5 text-[11px] font-medium text-amber-400">
            DEMO DATA
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-ink-600 bg-ink-850/90 px-2 py-0.5 text-[11px] font-medium text-fg-muted">
          <Lock className="size-3" aria-hidden />
          Under review
        </span>
      </div>

      <div className="relative mt-4 rounded-md border border-volt-400/25 bg-ink-900/80 px-3.5 py-3 shadow-[0_0_24px_-8px] shadow-volt-400/40">
        <div className="label flex items-center gap-2 text-volt-400">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-volt-400 opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-volt-400" />
          </span>
          {demo ? "Market cap (simulated)" : "Live market cap"}
        </div>
        <div className="tabular mt-1 text-2xl font-bold tracking-tight text-volt-400 [text-shadow:0_0_18px_rgb(76_247_166/0.45)]">
          {marketCapUsd != null ? formatUsdCompact(marketCapUsd) : "Not trading yet"}
        </div>
        <p className="mt-1 text-xs text-fg-subtle">Details are revealed if the project passes screening.</p>
      </div>
    </article>
  );
}
