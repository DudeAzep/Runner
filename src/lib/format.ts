const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("en-US");

/** Format integer cents as USD. Drops cents when they are zero. */
export function formatUsdCents(cents: number, opts: { forceCents?: boolean } = {}): string {
  const dollars = cents / 100;
  return opts.forceCents || cents % 100 !== 0 ? usd2.format(dollars) : usd0.format(dollars);
}

/** Compact USD for large figures, e.g. $1.2M. Input is whole USD. */
export function formatUsdCompact(usd: number): string {
  return `$${compact.format(usd)}`;
}

export function formatCompact(n: number | bigint): string {
  return compact.format(typeof n === "bigint" ? Number(n) : n);
}

export function formatInt(n: number | bigint): string {
  return int.format(n);
}

export function formatPercent(p: number, digits = 2): string {
  if (p > 0 && p < 10 ** -digits) return `<${(10 ** -digits).toFixed(digits)}%`;
  return `${p.toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}
