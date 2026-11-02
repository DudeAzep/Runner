import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { SCREENING_CRITERIA, type Screening } from "@/lib/types";
import { RiskBadge } from "./StatusBadges";

export function averageScore(s: Screening): number {
  const vals = SCREENING_CRITERIA.map((c) => s[c.key]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function ScoreBar({ label, hint, value }: { label: string; hint: string; value: number }) {
  const color = value >= 8 ? "bg-volt-400" : value >= 6 ? "bg-sky-400" : value >= 4 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-fg" title={hint}>
          {label}
        </span>
        <span className="tabular font-mono text-xs text-fg-muted">{value}/10</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-ink-700">
        <div className={cn("h-full rounded-sm", color)} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

function Authority({ label, revoked }: { label: string; revoked: boolean | null }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm">
      <span className="text-fg-muted">{label}</span>
      {revoked === null ? (
        <span className="text-fg-subtle">Unknown</span>
      ) : revoked ? (
        <span className="inline-flex items-center gap-1.5 text-volt-400">
          <CircleCheck className="size-4" /> Revoked
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-rose-400">
          <CircleX className="size-4" /> Active
        </span>
      )}
    </div>
  );
}

export function ScreeningReport({ screening }: { screening: Screening }) {
  const avg = averageScore(screening);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="tabular text-3xl font-semibold tracking-tight">
          {avg.toFixed(1)}
          <span className="text-base text-fg-subtle">/10</span>
        </div>
        <RiskBadge level={screening.riskLevel} />
        <span className="text-xs text-fg-subtle">
          Reviewed {formatDate(screening.createdAt)} · {screening.reviewedBy}
        </span>
      </div>

      <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {SCREENING_CRITERIA.map((c) => (
          <ScoreBar key={c.key} label={c.label} hint={c.hint} value={screening[c.key]} />
        ))}
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Authority label="Mint authority" revoked={screening.mintAuthorityRevoked} />
        <Authority label="Freeze authority" revoked={screening.freezeAuthorityRevoked} />
      </div>

      <div className="mt-6">
        <h4 className="label">Risk flags</h4>
        {screening.riskFlags.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {screening.riskFlags.map((f) => (
              <li key={f} className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-400">
                <TriangleAlert className="size-3" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-fg-muted">No risk flags recorded.</p>
        )}
      </div>

      {screening.screeningNotes && (
        <div className="mt-6">
          <h4 className="label">Reviewer notes</h4>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{screening.screeningNotes}</p>
        </div>
      )}
    </div>
  );
}
