import "server-only";

/**
 * Live market caps from DexScreener, cached in memory for a minute so the
 * public Explore page doesn't call DexScreener on every visit.
 */
const TTL_MS = 60_000;
const BATCH = 30; // DexScreener accepts up to 30 addresses per request
const cache = new Map<string, { value: number | null; at: number }>();

interface DexPair {
  baseToken?: { address?: string };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
}

export async function getLiveMarketCaps(mints: string[]): Promise<Map<string, number | null>> {
  const now = Date.now();
  const out = new Map<string, number | null>();
  const stale: string[] = [];
  for (const m of new Set(mints)) {
    const hit = cache.get(m);
    if (hit && now - hit.at < TTL_MS) out.set(m, hit.value);
    else stale.push(m);
  }

  for (let i = 0; i < stale.length; i += BATCH) {
    const chunk = stale.slice(i, i + BATCH);
    try {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`, {
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pairs = (await res.json()) as DexPair[];
      // Use the most liquid pair per token, as the screening report does.
      const best = new Map<string, DexPair>();
      for (const p of Array.isArray(pairs) ? pairs : []) {
        const addr = p.baseToken?.address;
        if (!addr) continue;
        const cur = best.get(addr);
        if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) best.set(addr, p);
      }
      for (const m of chunk) {
        const p = best.get(m);
        const value = p ? (p.marketCap ?? p.fdv ?? null) : null;
        cache.set(m, { value, at: now });
        out.set(m, value);
      }
    } catch {
      // DexScreener down or unreachable: fall back to the last known value, if any.
      for (const m of chunk) out.set(m, cache.get(m)?.value ?? null);
    }
  }
  return out;
}
