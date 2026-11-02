import { RISK_FLAG_OPTIONS, RISK_LEVELS, SCREENING_CRITERIA, type Screening } from "@/lib/types";

function triState(v: boolean | null | undefined) {
  return v === true ? "yes" : v === false ? "no" : "";
}

/** Structured screening inputs. Rendered inside an AdminForm. */
export function ScreeningFields({ screening }: { screening: Screening | null }) {
  const s = screening;
  const flags = new Set(s?.riskFlags ?? []);
  return (
    <div className="space-y-6">
      <div>
        <h3 className="label">Criteria scores (0–10, 10 = strongest / lowest risk)</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SCREENING_CRITERIA.map((c) => (
            <label key={c.key} className="flex items-start justify-between gap-3 rounded-md border border-ink-700 bg-ink-900 p-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{c.label}</span>
                <span className="mt-0.5 block text-xs text-fg-subtle">{c.hint}</span>
              </span>
              <select name={c.key} defaultValue={String(s?.[c.key] ?? 5)} className="field w-20 shrink-0 py-1.5 font-mono" aria-label={`${c.label} score`}>
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="label">Metrics at screening</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["marketCapUsd", "Market cap (USD)", s?.marketCapUsd],
            ["liquidityUsd", "Liquidity (USD)", s?.liquidityUsd],
            ["holderCount", "Holder count", s?.holderCount],
            ["top10HolderPct", "Top-10 holders %", s?.top10HolderPct],
          ].map(([name, label, val]) => (
            <label key={String(name)} className="block">
              <span className="text-xs text-fg-muted">{String(label)}</span>
              <input name={String(name)} inputMode="decimal" defaultValue={val == null ? "" : String(val)} placeholder="Unknown" className="field tabular mt-1 font-mono" />
            </label>
          ))}
          <label className="block">
            <span className="text-xs text-fg-muted">Mint authority revoked</span>
            <select name="mintAuthorityRevoked" defaultValue={triState(s?.mintAuthorityRevoked)} className="field mt-1">
              <option value="">Unknown</option>
              <option value="yes">Yes — revoked</option>
              <option value="no">No — active</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-fg-muted">Freeze authority revoked</span>
            <select name="freezeAuthorityRevoked" defaultValue={triState(s?.freezeAuthorityRevoked)} className="field mt-1">
              <option value="">Unknown</option>
              <option value="yes">Yes — revoked</option>
              <option value="no">No — active</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <h3 className="label">Risk flags / manipulation indicators</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {RISK_FLAG_OPTIONS.map((f) => (
            <label key={f} className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-fg-muted has-[:checked]:border-amber-400/40 has-[:checked]:text-amber-400">
              <input type="checkbox" name="riskFlags" value={f} defaultChecked={flags.has(f)} className="accent-amber-400" />
              {f}
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="label">Screening notes</span>
        <textarea
          name="screeningNotes"
          rows={5}
          maxLength={5000}
          defaultValue={s?.screeningNotes ?? ""}
          placeholder="Evidence, sources reviewed, concerns, and rationale. Notes are published with approved campaigns."
          className="field mt-2 resize-y"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-fg-muted">Recommendation</span>
          <select name="recommendation" defaultValue={s?.recommendation ?? "needs_info"} className="field mt-1">
            <option value="approve">Approve</option>
            <option value="needs_info">Needs more information</option>
            <option value="reject">Reject</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-fg-muted">Overall risk level</span>
          <select name="riskLevel" defaultValue={s?.riskLevel ?? "elevated"} className="field mt-1 capitalize">
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
