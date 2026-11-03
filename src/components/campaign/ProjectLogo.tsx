import { cn } from "@/lib/cn";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Coin logo. Shows the coin's image when `src` is given (e.g. from DexScreener),
 * over a deterministic monogram that doubles as the fallback.
 */
export function ProjectLogo({
  ticker,
  name,
  size = 44,
  src,
  className,
}: {
  ticker: string;
  name: string;
  size?: number;
  src?: string | null;
  className?: string;
}) {
  const h = hash(ticker);
  const hueA = 250 + (h % 70); // violet → blue range
  const hueB = 140 + ((h >> 8) % 40); // green range
  const angle = (h >> 16) % 360;
  const letters = ticker.slice(0, 2);

  return (
    <span
      role="img"
      aria-label={`${name} logo`}
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${angle}deg, oklch(0.42 0.16 ${hueA}) 0%, oklch(0.24 0.05 ${hueA}) 55%, oklch(0.5 0.15 ${hueB}) 140%)`,
      }}
    >
      <span className="font-mono font-semibold tracking-tight text-white/95" style={{ fontSize: size * 0.34 }}>
        {letters}
      </span>
      {src && (
        // Sits on top of the monogram; if the image fails to load, the monogram shows through.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
