import "server-only";

/**
 * Live market data (market cap + coin image) from DexScreener, cached in
 * memory for a minute so the public Explore page doesn't call DexScreener on
 * every visit.
 */
const TTL_MS = 60_000;
const BATCH = 30; // DexScreener accepts up to 30 addresses per request

export interface MarketInfo {
  marketCapUsd: number | null;
  imageUrl: string | null;
}

const EMPTY: MarketInfo = { marketCapUsd: null, imageUrl: null };
const cache = new Map<string, { value: MarketInfo; at: number }>();

interface DexPair {
  baseToken?: { address?: string };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  info?: { imageUrl?: string };
}

/** Only accept plain https image links. */
function safeImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Demo records use made-up addresses with no market data, so they get a
 * simulated cap instead: stable per coin, drifting a little each minute.
 * Only ever used for records marked DEMO DATA.
 */
export function simulatedDemoMarketCap(seed: string, baseUsd?: number | null): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const base = baseUsd && baseUsd > 0 ? baseUsd : 60_000 + (h % 2_400_000);
  const minute = Math.floor(Date.now() / 60_000);
  const wobble = Math.sin(minute / 7 + (h % 97)) * 0.12 + Math.sin(minute / 53 + (h % 13)) * 0.2;
  return Math.round(base * (1 + wobble));
}

/** Market data for a mix of real and demo records: DexScreener for real, simulated cap (no image) for demo. */
export async function getMarketInfoFor(
  items: { key: string; mint: string; demo: boolean; demoBaseUsd?: number | null }[],
): Promise<Map<string, MarketInfo>> {
  const real = items.filter((i) => !i.demo);
  const live = real.length ? await getLiveMarketInfo(real.map((i) => i.mint)) : new Map<string, MarketInfo>();
  const out = new Map<string, MarketInfo>();
  for (const i of items) {
    out.set(i.key, i.demo ? { marketCapUsd: simulatedDemoMarketCap(i.key, i.demoBaseUsd), imageUrl: null } : (live.get(i.mint) ?? EMPTY));
  }
  return out;
}

export async function getLiveMarketInfo(mints: string[]): Promise<Map<string, MarketInfo>> {
  const now = Date.now();
  const out = new Map<string, MarketInfo>();
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
      // Market cap from the most liquid pair (as the screening report does);
      // image from whichever pair has one.
      const best = new Map<string, DexPair>();
      const images = new Map<string, string>();
      for (const p of Array.isArray(pairs) ? pairs : []) {
        const addr = p.baseToken?.address;
        if (!addr) continue;
        const cur = best.get(addr);
        if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) best.set(addr, p);
        const img = safeImageUrl(p.info?.imageUrl);
        if (img && !images.has(addr)) images.set(addr, img);
      }
      for (const m of chunk) {
        const p = best.get(m);
        const value: MarketInfo = {
          marketCapUsd: p ? (p.marketCap ?? p.fdv ?? null) : null,
          imageUrl: safeImageUrl(p?.info?.imageUrl) ?? images.get(m) ?? null,
        };
        cache.set(m, { value, at: now });
        out.set(m, value);
      }
    } catch {
      // DexScreener down or unreachable: fall back to the last known value, if any.
      for (const m of chunk) out.set(m, cache.get(m)?.value ?? EMPTY);
    }
  }
  return out;
}
