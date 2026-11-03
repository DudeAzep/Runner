import { CircleCheck, CircleX, ExternalLink, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, formatUsdCompact } from "@/lib/format";
import type { TokenReport } from "@/lib/types";
import { shortenAddress } from "@/lib/validation/solana";

function Authority({ label, value }: { label: string; value: string | null }) {
  const revoked = value === null;
  return (
    <div className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm">
      <span className="text-fg-muted">{label}</span>
      {revoked ? (
        <span className="inline-flex items-center gap-1.5 text-volt-400">
          <CircleCheck className="size-4" /> Revoked
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-rose-400" title={value}>
          <CircleX className="size-4" /> Active ({shortenAddress(value, 4)})
        </span>
      )}
    </div>
  );
}

/** Verified facts fetched from Solana RPC + DexScreener to support screening. */
export function TokenReportPanel({ report }: { report: TokenReport }) {
  const stat = (label: string, value: string) => (
    <div>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
  const usd = (v: number | null) => (v == null ? "—" : formatUsdCompact(v));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
        <Badge tone="volt">ON-CHAIN DATA</Badge>
        Fetched {formatDateTime(report.fetchedAt)} · {report.tokenProgram ?? "unknown program"}
        {report.pairUrl && (
          <a href={report.pairUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:underline">
            DexScreener <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Market cap", usd(report.marketCapUsd ?? report.fdvUsd))}
        {stat("Liquidity", usd(report.liquidityUsd))}
        {stat("24h volume", usd(report.volume24hUsd))}
        {stat("Top-10 accounts", report.top10Pct == null ? "—" : `${report.top10Pct.toFixed(1)}%`)}
      </dl>
      {report.decimals != null && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Authority label="Mint authority" value={report.mintAuthority} />
          <Authority label="Freeze authority" value={report.freezeAuthority} />
        </div>
      )}
      {report.largestAccounts.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-fg-subtle hover:text-fg">Largest token accounts (includes LP & exchange accounts)</summary>
          <ul className="tabular mt-2 space-y-1 font-mono">
            {report.largestAccounts.slice(0, 10).map((a) => (
              <li key={a.address} className="flex justify-between gap-3 text-fg-muted">
                <span>{shortenAddress(a.address, 6)}</span>
                <span>{a.pct.toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {report.errors.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-400">
          {report.errors.map((e) => (
            <li key={e} className="flex items-start gap-1.5">
              <TriangleAlert className="mt-px size-3.5 shrink-0" /> {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
